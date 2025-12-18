import pandas as pd
import numpy as np
import joblib
from datetime import datetime, timedelta
import json
import sys

# Load model and dataset
model = joblib.load('crowd_prediction_model.pkl')
df = pd.read_csv('concert_crowd_dataset.csv')
df['timestamp'] = pd.to_datetime(df['timestamp'])
df['hour'] = df['timestamp'].dt.hour
df['date'] = df['timestamp'].dt.date

# Load encoders
le_zone = joblib.load('zone_encoder.pkl')
le_weather = joblib.load('weather_encoder.pkl')
le_day = joblib.load('day_encoder.pkl')

def encode_inputs(zone='Gate 1', weather='clear', day_of_week='Monday'):
    zone_enc = le_zone.transform([zone])[0] if zone in le_zone.classes_ else 0
    weather_enc = le_weather.transform([weather])[0] if weather in le_weather.classes_ else 0
    day_enc = le_day.transform([day_of_week])[0] if day_of_week in le_day.classes_ else 0
    return zone_enc, weather_enc, day_enc

def smooth(series, window=7):
    return series.rolling(window, min_periods=1).mean().fillna(method='bfill').fillna(method='ffill')

def predict_hourly(now):
    preds = []
    for i in range(12):
        dt = now + timedelta(hours=i)
        hour = dt.hour
        day = dt.strftime('%A')
        zone_enc, weather_enc, day_enc = encode_inputs(day_of_week=day)
        # Use historical averages for other features
        avg = df[df['hour'] == hour]
        zone_cap = int(avg['zone_capacity'].mean() if not avg.empty else 1000)
        tickets = int(avg['tickets_sold'].mean() if not avg.empty else 500)
        live = int(avg['live_count'].mean() if not avg.empty else 0)
        entry = float(avg['avg_entry_rate'].mean() if not avg.empty else 1.0)
        artist = int(avg['artist_popularity'].mean() if not avg.empty else 5)
        minutes_to_show = max(0, 18 - hour) * 60  # generic
        features = pd.DataFrame([{
            'zone_capacity': zone_cap,
            'tickets_sold': tickets,
            'live_count': live,
            'avg_entry_rate': entry,
            'artist_popularity': artist,
            'time_to_show_mins': minutes_to_show,
            'hour': hour,
            'minute': 0,
            'zone_encoded': zone_enc,
            'weather_encoded': weather_enc,
            'day_encoded': day_enc
        }])
        pred = int(round(model.predict(features)[0]))
        preds.append({'time': dt.strftime('%H:%M'), 'predicted_crowd': max(0, pred)})
    return preds

def predict_daily(start_date, days):
    preds = []
    for i in range(days):
        dt = start_date + timedelta(days=i)
        day = dt.strftime('%A')
        zone_enc, weather_enc, day_enc = encode_inputs(day_of_week=day)
        # Use historical daily average as proxy
        daily = df[df['timestamp'].dt.date == dt.date()]
        if daily.empty:
            # fallback: use same-day-of-week historical avg
            same_day = df[df['timestamp'].dt.day_name() == day]
            zone_cap = int(same_day['zone_capacity'].mean() if not same_day.empty else 1000)
            tickets = int(same_day['tickets_sold'].mean() if not same_day.empty else 500)
            live = int(same_day['live_count'].mean() if not same_day.empty else 0)
            entry = float(same_day['avg_entry_rate'].mean() if not same_day.empty else 1.0)
            artist = int(same_day['artist_popularity'].mean() if not same_day.empty else 5)
        else:
            zone_cap = int(daily['zone_capacity'].mean())
            tickets = int(daily['tickets_sold'].mean())
            live = int(daily['live_count'].mean())
            entry = float(daily['avg_entry_rate'].mean())
            artist = int(daily['artist_popularity'].mean())
        minutes_to_show = 12 * 60
        features = pd.DataFrame([{
            'zone_capacity': zone_cap,
            'tickets_sold': tickets,
            'live_count': live,
            'avg_entry_rate': entry,
            'artist_popularity': artist,
            'time_to_show_mins': minutes_to_show,
            'hour': 12,
            'minute': 0,
            'zone_encoded': zone_enc,
            'weather_encoded': weather_enc,
            'day_encoded': day_enc
        }])
        pred = int(round(model.predict(features)[0]))
        preds.append({'day': dt.strftime('%a'), 'predicted_crowd': max(0, pred)})
    return preds

def predict_monthly(start_date):
    preds = []
    for i in range(30):
        dt = start_date + timedelta(days=i)
        day = dt.strftime('%A')
        zone_enc, weather_enc, day_enc = encode_inputs(day_of_week=day)
        # Use historical same-day-of-week averages
        same_day = df[df['timestamp'].dt.day_name() == day]
        zone_cap = int(same_day['zone_capacity'].mean() if not same_day.empty else 1000)
        tickets = int(same_day['tickets_sold'].mean() if not same_day.empty else 500)
        live = int(same_day['live_count'].mean() if not same_day.empty else 0)
        entry = float(same_day['avg_entry_rate'].mean() if not same_day.empty else 1.0)
        artist = int(same_day['artist_popularity'].mean() if not same_day.empty else 5)
        minutes_to_show = 12 * 60
        features = pd.DataFrame([{
            'zone_capacity': zone_cap,
            'tickets_sold': tickets,
            'live_count': live,
            'avg_entry_rate': entry,
            'artist_popularity': artist,
            'time_to_show_mins': minutes_to_show,
            'hour': 12,
            'minute': 0,
            'zone_encoded': zone_enc,
            'weather_encoded': weather_enc,
            'day_encoded': day_enc
        }])
        pred = int(round(model.predict(features)[0]))
        preds.append({'date': dt.strftime('%Y-%m-%d'), 'predicted_crowd': max(0, pred)})
    return preds

# Main generation
now = datetime.utcnow()
today_raw = predict_hourly(now)
week_raw = predict_daily(now, 7)
month_raw = predict_monthly(now)

# Apply 7-point moving average smoothing
today_vals = pd.Series([p['predicted_crowd'] for p in today_raw])
week_vals = pd.Series([p['predicted_crowd'] for p in week_raw])
month_vals = pd.Series([p['predicted_crowd'] for p in month_raw])

smoothed_today = smooth(today_vals, window=min(7, len(today_vals))).astype(int).tolist()
smoothed_week = smooth(week_vals, window=min(7, len(week_vals))).astype(int).tolist()
smoothed_month = smooth(month_vals, window=min(7, len(month_vals))).astype(int).tolist()

# Assemble final JSON
result = {
    'today': [{'time': today_raw[i]['time'], 'predicted_crowd': smoothed_today[i]} for i in range(len(today_raw))],
    'week': [{'day': week_raw[i]['day'], 'predicted_crowd': smoothed_week[i]} for i in range(len(week_raw))],
    'month': [{'date': month_raw[i]['date'], 'predicted_crowd': smoothed_month[i]} for i in range(len(month_raw))]
}

print(json.dumps(result, indent=2))
print("Trends engine finished successfully.", file=sys.stderr)
