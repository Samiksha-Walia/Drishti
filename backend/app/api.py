from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
from werkzeug.utils import secure_filename
import cv2
import numpy as np
import base64
import os
import tempfile
import shutil
import json
import queue
import sqlite3
import os
from datetime import datetime
from uuid import uuid4

from bothCSF import analyze_frame


CORS_ORIGINS = os.environ.get('DRISHTI_CORS_ORIGINS', 'http://localhost:3000').split(',')

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": CORS_ORIGINS}}, supports_credentials=False)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, 'data_store.db')
EXPORT_TOKEN = os.environ.get('DRISHTI_EXPORT_TOKEN', 'drishti-demo-token')

dashboard_subscribers = set()

VALID_ROLES = {'viewer', 'responder', 'dispatcher', 'analyst', 'admin'}


def _current_role():
    header_role = request.headers.get('X-User-Role') or request.args.get('role')
    role = (header_role or 'viewer').strip().lower()
    if role not in VALID_ROLES:
        return 'viewer'
    return role


def _check_role(*allowed_roles):
    normalized = {role.lower() for role in allowed_roles if role}
    role = _current_role()
    if not normalized or role == 'admin' or role in normalized:
        return True, role
    return False, role


def _role_denied_response(allowed_roles, role):
    readable = []
    for candidate in allowed_roles:
        if candidate and candidate not in readable:
            readable.append(candidate)
    if 'admin' not in readable:
        readable.append('admin')
    return jsonify({'error': 'forbidden', 'requiredRoles': readable, 'role': role}), 403


def _iso_now():
    return datetime.utcnow().isoformat() + 'Z'


def _seed_alerts():
    now = _iso_now()
    return [
        {
            'id': str(uuid4()),
            'type': 'crowd_bottleneck',
            'severity': 'high',
            'title': 'Crowd surge near Gate 3',
            'description': 'Vertex AI predicts density > 90% in 12 minutes. Deploy barriers and redirect flow.',
            'location': {'zone': 'Gate 3', 'lat': 28.6139, 'lng': 77.2090},
            'status': 'active',
            'aiConfidence': 0.92,
            'createdAt': now,
            'reportedBy': 'Vertex AI Forecast'
        },
        {
            'id': str(uuid4()),
            'type': 'fire',
            'severity': 'medium',
            'title': 'Smoke detected at Food Court',
            'description': 'Thermal camera flagged abnormal heat signature. Send fire marshal.',
            'location': {'zone': 'Food Court', 'lat': 28.6149, 'lng': 77.2080},
            'status': 'acknowledged',
            'aiConfidence': 0.81,
            'createdAt': now,
            'reportedBy': 'Camera CAM-015'
        }
    ]


def _seed_analytics():
    return [
        {
            'id': str(uuid4()),
            'location': {'venue': 'demo-venue-001'},
            'timestamp': _iso_now(),
            'snapshot': {'cam-001': 0.72, 'cam-008': 0.35, 'cam-023': 1.1},
            'data': [
                {
                    'zoneName': 'Main Entrance',
                    'predictedDensity': 0.82,
                    'bottleneckRisk': 0.76,
                    'timeToBottleneck': 14,
                    'predictionSource': 'vertex_ai'
                },
                {
                    'zoneName': 'VIP Pavilion',
                    'predictedDensity': 0.54,
                    'bottleneckRisk': 0.33,
                    'timeToBottleneck': 25,
                    'predictionSource': 'heuristic'
                }
            ]
        }
    ]


def _seed_lost_found():
    return [
        {
            'id': str(uuid4()),
            'name': 'Aarav Kumar',
            'age': 9,
            'relation': 'child',
            'description': 'Blue t-shirt with white stripes, denim shorts, 4ft3in.',
            'lastSeen': {'zone': 'Zone C - Food Court', 'time': _iso_now()},
            'reportedAt': _iso_now(),
            'status': 'open',
            'contact': '+91-90000-00001',
            'notes': 'Responds to nickname "Avi".',
            'photoUrl': 'https://placehold.co/200x200?text=A'
        },
        {
            'id': str(uuid4()),
            'name': 'Meera Shah',
            'age': 67,
            'relation': 'elderly',
            'description': 'Pink saree, grey hair bun, walking cane.',
            'lastSeen': {'zone': 'Zone A - Main Stage', 'time': _iso_now()},
            'reportedAt': _iso_now(),
            'status': 'investigating',
            'contact': '+91-90000-00002',
            'notes': 'Medical condition: diabetes.',
            'photoUrl': 'https://placehold.co/200x200?text=M'
        }
    ]


def _init_db():
    conn = sqlite3.connect(DB_FILE)
    conn.execute('CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
    conn.execute('CREATE TABLE IF NOT EXISTS analytics (id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
    conn.execute('CREATE TABLE IF NOT EXISTS lost_found (id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
    conn.execute('CREATE TABLE IF NOT EXISTS evacuation_plans (id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
    conn.commit()
    conn.close()


def _db_read_all(table_name):
    if not os.path.exists(DB_FILE):
        return []
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.execute(f'SELECT payload FROM {table_name}')
    items = [json.loads(row[0]) for row in cursor.fetchall()]
    conn.close()
    return items


def _db_upsert(table_name, item):
    conn = sqlite3.connect(DB_FILE)
    conn.execute(
        f'INSERT INTO {table_name} (id, payload) VALUES (?, ?) '
        f'ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        (item['id'], json.dumps(item))
    )
    conn.commit()
    conn.close()


def _db_delete(table_name, item_id):
    conn = sqlite3.connect(DB_FILE)
    conn.execute(f'DELETE FROM {table_name} WHERE id=?', (item_id,))
    conn.commit()
    conn.close()


def _initialize_store():
    _init_db()
    alerts = _db_read_all('alerts')
    analytics = _db_read_all('analytics')
    lost_found = _db_read_all('lost_found')
    evacuation_plans = _db_read_all('evacuation_plans')

    if not alerts:
        alerts = _seed_alerts()
        for alert in alerts:
            _db_upsert('alerts', alert)
    if not analytics:
        analytics = _seed_analytics()
        for record in analytics:
            _db_upsert('analytics', record)
    if not lost_found:
        lost_found = _seed_lost_found()
        for entry in lost_found:
            _db_upsert('lost_found', entry)

    if not evacuation_plans:
        evacuation_plans = []

    return {
        'alerts': alerts,
        'analytics': analytics,
        'lost_found': lost_found,
        'evacuation_plans': evacuation_plans
    }


stores = _initialize_store()
alerts_store = stores['alerts']
analytics_store = stores['analytics']
lost_found_store = stores['lost_found']
evacuation_plans_store = stores['evacuation_plans']


def _save_alert(alert):
    _db_upsert('alerts', alert)


def _save_analytics(record):
    _db_upsert('analytics', record)


def _save_lost_found(entry):
    _db_upsert('lost_found', entry)


def _save_evacuation_plan(plan):
    _db_upsert('evacuation_plans', plan)


def _remove_from_store(store, item_id, table_name):
    index = next((idx for idx, item in enumerate(store) if item['id'] == item_id), None)
    if index is None:
        return False
    store.pop(index)
    _db_delete(table_name, item_id)
    return True


def _broadcast_event(event_type, payload):
    if not dashboard_subscribers:
        return
    message = json.dumps({'type': event_type, 'payload': payload})
    for subscriber in list(dashboard_subscribers):
        try:
            subscriber.put_nowait(message)
        except queue.Full:
            dashboard_subscribers.discard(subscriber)


def _find_by_id(collection, item_id):
    for item in collection:
        if item['id'] == item_id:
            return item
    return None


def _encode_frame(frame) -> str:
    """Encode an OpenCV frame as base64 JPEG."""
    _, buffer = cv2.imencode('.jpg', frame)
    return base64.b64encode(buffer).decode('utf-8')


@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check for orchestrators."""
    return jsonify({'status': 'ok'}), 200


@app.route('/api/dashboard-stream', methods=['GET'])
def dashboard_stream():
    def event_generator(client_queue):
        try:
            yield f'data: {json.dumps({"type": "connected", "timestamp": _iso_now()})}\n\n'
            while True:
                message = client_queue.get()
                yield f'data: {message}\n\n'
        finally:
            dashboard_subscribers.discard(client_queue)

    client_queue = queue.Queue(maxsize=50)
    dashboard_subscribers.add(client_queue)
    response = Response(stream_with_context(event_generator(client_queue)), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    return response


@app.route('/api/alerts', methods=['GET'])
def list_alerts():
    return jsonify({'items': alerts_store}), 200


@app.route('/api/alerts/<alert_id>', methods=['GET'])
def get_alert(alert_id):
    alert = _find_by_id(alerts_store, alert_id)
    if alert is None:
        return jsonify({'error': 'Alert not found'}), 404
    return jsonify(alert), 200


@app.route('/api/alerts', methods=['POST'])
def create_alert():
    allowed, role = _check_role('dispatcher', 'responder', 'admin')
    if not allowed:
        return _role_denied_response(['dispatcher', 'responder', 'admin'], role)

    payload = request.get_json(force=True, silent=True) or {}
    alert = {
        'id': str(uuid4()),
        'title': payload.get('title', 'New Alert'),
        'description': payload.get('description', ''),
        'type': payload.get('type', 'crowd'),
        'severity': payload.get('severity', 'medium'),
        'location': payload.get('location', {}),
        'status': payload.get('status', 'active'),
        'aiConfidence': payload.get('aiConfidence', 0.5),
        'createdAt': _iso_now(),
        'reportedBy': payload.get('reportedBy', 'Command Center')
    }
    alerts_store.insert(0, alert)
    _save_alert(alert)
    _broadcast_event('alert_created', alert)
    return jsonify(alert), 201


@app.route('/api/alerts/<alert_id>', methods=['PATCH'])
def update_alert(alert_id):
    allowed, role = _check_role('dispatcher', 'responder', 'admin')
    if not allowed:
        return _role_denied_response(['dispatcher', 'responder', 'admin'], role)

    alert = _find_by_id(alerts_store, alert_id)
    if alert is None:
        return jsonify({'error': 'Alert not found'}), 404

    payload = request.get_json(force=True, silent=True) or {}
    for field in ['status', 'severity', 'description', 'title']:
        if field in payload:
            alert[field] = payload[field]
    if 'location' in payload:
        alert['location'] = payload['location']
    alert['updatedAt'] = _iso_now()
    _save_alert(alert)
    _broadcast_event('alert_updated', alert)
    return jsonify(alert), 200


@app.route('/api/alerts/<alert_id>', methods=['DELETE'])
def delete_alert(alert_id):
    allowed, role = _check_role('dispatcher', 'admin')
    if not allowed:
        return _role_denied_response(['dispatcher', 'admin'], role)

    removed = _remove_from_store(alerts_store, alert_id, 'alerts')
    if not removed:
        return jsonify({'error': 'Alert not found'}), 404
    _broadcast_event('alert_deleted', {'id': alert_id})
    return '', 204


@app.route('/api/analytics', methods=['GET'])
def list_analytics():
    venue = request.args.get('venue')
    if venue:
        filtered = [record for record in analytics_store if record['location'].get('venue') == venue]
    else:
        filtered = analytics_store
    return jsonify({'items': filtered}), 200


@app.route('/api/analytics', methods=['POST'])
def create_analytics_record():
    allowed, role = _check_role('analyst', 'dispatcher', 'admin')
    if not allowed:
        return _role_denied_response(['analyst', 'dispatcher', 'admin'], role)

    payload = request.get_json(force=True, silent=True) or {}
    record = {
        'id': str(uuid4()),
        'location': payload.get('location', {'venue': 'demo-venue-001'}),
        'timestamp': _iso_now(),
        'snapshot': payload.get('snapshot', {}),
        'data': payload.get('data', [])
    }
    analytics_store.insert(0, record)
    _save_analytics(record)
    _broadcast_event('analytics_created', record)
    return jsonify(record), 201


@app.route('/api/lost-found', methods=['GET'])
def list_lost_found():
    return jsonify({'items': lost_found_store}), 200


@app.route('/api/lost-found', methods=['POST'])
def create_lost_found():
    allowed, role = _check_role('responder', 'dispatcher', 'admin')
    if not allowed:
        return _role_denied_response(['responder', 'dispatcher', 'admin'], role)

    payload = request.get_json(force=True, silent=True) or {}
    entry = {
        'id': str(uuid4()),
        'name': payload.get('name', 'Unknown'),
        'age': payload.get('age'),
        'relation': payload.get('relation', 'unknown'),
        'description': payload.get('description', ''),
        'lastSeen': payload.get('lastSeen', {}),
        'reportedAt': _iso_now(),
        'status': payload.get('status', 'open'),
        'contact': payload.get('contact'),
        'notes': payload.get('notes', ''),
        'photoUrl': payload.get('photoUrl')
    }
    lost_found_store.insert(0, entry)
    _save_lost_found(entry)
    _broadcast_event('lost_found_created', entry)
    return jsonify(entry), 201


@app.route('/api/lost-found/<entry_id>', methods=['PATCH'])
def update_lost_found(entry_id):
    allowed, role = _check_role('responder', 'dispatcher', 'admin')
    if not allowed:
        return _role_denied_response(['responder', 'dispatcher', 'admin'], role)

    entry = _find_by_id(lost_found_store, entry_id)
    if entry is None:
        return jsonify({'error': 'Lost & found record not found'}), 404

    payload = request.get_json(force=True, silent=True) or {}
    for field in ['status', 'notes', 'description', 'contact']:
        if field in payload:
            entry[field] = payload[field]
    if 'lastSeen' in payload:
        entry['lastSeen'] = payload['lastSeen']
    entry['updatedAt'] = _iso_now()
    _save_lost_found(entry)
    _broadcast_event('lost_found_updated', entry)
    return jsonify(entry), 200


@app.route('/api/lost-found/<entry_id>', methods=['DELETE'])
def delete_lost_found(entry_id):
    allowed, role = _check_role('dispatcher', 'admin')
    if not allowed:
        return _role_denied_response(['dispatcher', 'admin'], role)

    removed = _remove_from_store(lost_found_store, entry_id, 'lost_found')
    if not removed:
        return jsonify({'error': 'Lost & found record not found'}), 404
    _broadcast_event('lost_found_deleted', {'id': entry_id})
    return '', 204


def _generate_evacuation_plan(payload):
    origin = payload.get('originZone', 'Main Stage')
    hazard = payload.get('hazardType', 'crowd')
    exits = payload.get('availableExits', ['Gate 1', 'Gate 2', 'Gate 3'])
    recommended_exit = exits[0] if exits else 'Command Post'

    timeline = [
        {'minute': 0, 'action': 'Broadcast multilingual alert', 'status': 'pending'},
        {'minute': 5, 'action': f'Deploy ushers to {origin}', 'status': 'pending'},
        {'minute': 10, 'action': f'Open {recommended_exit} and guide attendees', 'status': 'pending'}
    ]

    plan_id = str(uuid4())

    return {
        'planId': plan_id,
        'originZone': origin,
        'hazardType': hazard,
        'availableExits': exits,
        'recommendedExit': recommended_exit,
        'estimatedEvacuationTime': 12,
        'steps': timeline,
        'notes': 'Plan generated using current congestion snapshot and exit capacities.'
    }


@app.route('/api/evacuation-plan', methods=['POST'])
def evacuation_plan():
    allowed, role = _check_role('analyst', 'dispatcher', 'admin')
    if not allowed:
        return _role_denied_response(['analyst', 'dispatcher', 'admin'], role)

    payload = request.get_json(force=True, silent=True) or {}
    plan = _generate_evacuation_plan(payload)
    plan_record = {
        **plan,
        'requestedAt': _iso_now(),
        'input': payload
    }
    evacuation_plans_store.insert(0, plan_record)
    _save_evacuation_plan(plan_record)
    _broadcast_event('evacuation_plan_created', plan_record)
    return jsonify(plan), 200


@app.route('/api/evacuation-plans/<plan_id>/share', methods=['POST'])
def share_evacuation_plan(plan_id):
    allowed, role = _check_role('analyst', 'dispatcher', 'admin')
    if not allowed:
        return _role_denied_response(['analyst', 'dispatcher', 'admin'], role)

    plan = _find_by_id(evacuation_plans_store, plan_id)
    if plan is None:
        return jsonify({'error': 'Evacuation plan not found'}), 404

    payload = request.get_json(force=True, silent=True) or {}
    share_entry = {
        'recipient': payload.get('recipient') or 'Clipboard Share',
        'method': payload.get('method', 'clipboard'),
        'sharedAt': _iso_now()
    }
    plan.setdefault('shares', []).insert(0, share_entry)
    _save_evacuation_plan(plan)
    _broadcast_event('evacuation_plan_shared', {'planId': plan_id, 'share': share_entry})
    return jsonify({'message': 'Share logged', 'share': share_entry}), 200


@app.route('/api/evacuation-plans', methods=['GET'])
def list_evacuation_plans():
    limit = request.args.get('limit', type=int) or 10
    return jsonify({'items': evacuation_plans_store[:limit]}), 200


@app.route('/api/evacuation-plans/<plan_id>', methods=['GET'])
def get_evacuation_plan(plan_id):
    plan = _find_by_id(evacuation_plans_store, plan_id)
    if plan is None:
        return jsonify({'error': 'Evacuation plan not found'}), 404
    return jsonify(plan), 200


@app.route('/api/data-export', methods=['GET'])
def export_data():
    allowed, role = _check_role('admin')
    if not allowed:
        return _role_denied_response(['admin'], role)

    token = request.headers.get('X-Admin-Token') or request.args.get('token')
    if token != EXPORT_TOKEN:
        return jsonify({'error': 'Forbidden'}), 403

    return jsonify({
        'generatedAt': _iso_now(),
        'alerts': alerts_store,
        'lost_found': lost_found_store,
        'analytics': analytics_store,
        'evacuation_plans': evacuation_plans_store
    }), 200


def _save_upload_to_temp(upload):
    temp_dir = tempfile.mkdtemp()
    filename = secure_filename(upload.filename or 'upload.mp4')
    temp_path = os.path.join(temp_dir, filename or 'upload.mp4')
    upload.save(temp_path)
    return temp_dir, temp_path


def _cleanup_temp(temp_dir):
    if temp_dir and os.path.exists(temp_dir):
        shutil.rmtree(temp_dir, ignore_errors=True)


def _analyze_video_file(temp_path):
    cap = cv2.VideoCapture(temp_path)
    if not cap.isOpened():
        raise ValueError('Could not open video file')

    fire_smoke_detections = []
    processed_frames = []
    people_counts = []

    sample_interval = 30
    frame_index = 0
    processed = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_index % sample_interval == 0:
            processed += 1
            results = analyze_frame(frame)
            people_counts.append(results['people_count'])
            fire_smoke_detections.extend(results['fire_smoke_predictions'])

            if len(processed_frames) < 5:
                processed_frames.append(_encode_frame(results['frame']))

        frame_index += 1

        if frame_index >= 900:  # cap processing time (~30s at 30fps)
            break

    cap.release()

    avg_people = int(round(sum(people_counts) / len(people_counts))) if people_counts else 0

    return {
        'average_people': avg_people,
        'fire_smoke_predictions': fire_smoke_detections,
        'sample_frames': processed_frames,
        'message': f'Analysis completed on {processed} sampled frames.'
    }


@app.route('/api/analyze-video/', methods=['POST'])
@app.route('/api/analyze', methods=['POST'])  # backward compatibility
def analyze_video():
    """Analyze uploaded video for people count + fire/smoke anomalies."""
    upload = request.files.get('file')
    if upload is None or upload.filename == '':
        return jsonify({'error': 'No video file provided'}), 400

    temp_dir = None
    try:
        temp_dir, temp_path = _save_upload_to_temp(upload)
        response = _analyze_video_file(temp_path)
        return jsonify(response), 200
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500
    finally:
        if temp_dir:
            _cleanup_temp(temp_dir)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)