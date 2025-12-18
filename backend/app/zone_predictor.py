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

def predict_zone_15min_ahead(zone_name):
    now = datetime.utcnow()
    dt = now + timedelta(minutes=15)
    hour = dt.hour
    day = dt.strftime('%A')
    zone_enc, weather_enc, day_enc = encode_inputs(zone=zone_name, day_of_week=day)
    # Use zone-specific historical averages if available; otherwise fall back to global
    if 'zone' in df.columns and zone_name in df['zone'].values:
        zone_df = df[df['zone'] == zone_name]
    else:
        zone_df = df
    # Helper to get mean with fallback
    def safe_mean(col):
        val = zone_df[col].mean()
        return int(val) if pd.notna(val) else int(df[col].mean())
    zone_cap = safe_mean('zone_capacity')
    tickets = safe_mean('tickets_sold')
    live = safe_mean('live_count')
    entry = zone_df['avg_entry_rate'].mean()
    if pd.isna(entry):
        entry = df['avg_entry_rate'].mean()
    artist = safe_mean('artist_popularity')
    minutes_to_show = max(0, 18 - hour) * 60
    features = pd.DataFrame([{
        'zone_capacity': zone_cap,
        'tickets_sold': tickets,
        'live_count': live,
        'avg_entry_rate': entry,
        'artist_popularity': artist,
        'time_to_show_mins': minutes_to_show,
        'hour': hour,
        'minute': dt.minute,
        'zone_encoded': zone_enc,
        'weather_encoded': weather_enc,
        'day_encoded': day_enc
    }])
    pred = int(round(model.predict(features)[0]))
    return max(0, pred)

# Define zones matching the dataset
zones = [
    'Fan Zone Right', 'Level 1', 'West Block', 'Fan Zone Left',
    'VIP Lounge', 'Front Pit', 'Back Pit', 'General Admission',
    'Premium Lounge', 'Upper Deck'
]

predictions = {}
for zone in zones:
    predictions[zone] = predict_zone_15min_ahead(zone)

print(json.dumps(predictions, indent=2))
