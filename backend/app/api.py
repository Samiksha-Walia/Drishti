from flask import Flask, request, jsonify
import cv2
import numpy as np
import base64
import os
import tempfile
from crowd_analysis import analyze_frame

app = Flask(__name__)

@app.route('/api/analyze', methods=['POST'])
def analyze_video():
    """API endpoint to analyze video for crowd and fire/smoke detection"""
    try:
        # Check if the post request has the file part
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
            
        # Save uploaded file to a temporary location
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, file.filename)
        file.save(temp_path)
        
        # Open the video file
        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            return jsonify({'error': 'Could not open video file'}), 400
            
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Sample frames for analysis (analyze every 30th frame)
        sample_interval = 30
        people_counts = []
        fire_smoke_detections = []
        processed_frames = []
        
        frame_index = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            # Only process every sample_interval frames
            if frame_index % sample_interval == 0:
                # Analyze the frame
                results = analyze_frame(frame)
                
                # Store results
                people_counts.append(results['people_count'])
                fire_smoke_detections.extend(results['fire_smoke_predictions'])
                
                # Convert the processed frame to base64 for the first 5 frames
                if len(processed_frames) < 5:
                    _, buffer = cv2.imencode('.jpg', results['frame'])
                    img_str = base64.b64encode(buffer).decode('utf-8')
                    processed_frames.append(img_str)
            
            frame_index += 1
            
            # Process at most 300 frames (10 seconds of a 30fps video)
            if frame_index >= 300:
                break
                
        cap.release()
        
        # Clean up the temporary file
        os.remove(temp_path)
        os.rmdir(temp_dir)
        
        # Calculate average people count
        avg_people = sum(people_counts) / len(people_counts) if people_counts else 0
        
        # Return the analysis results
        return jsonify({
            'average_people': round(avg_people),
            'fire_smoke_predictions': fire_smoke_detections,
            'sample_frames': processed_frames[:5],  # Return up to 5 processed frames
            'message': 'Analysis completed successfully using trained models for smoke, fire, and crowd detection.'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)