import joblib
import pandas as pd
from datetime import datetime

# Load trained model and encoders
model = joblib.load("crowd_prediction_model.pkl")
le_zone = joblib.load("zone_encoder.pkl")
le_weather = joblib.load("weather_encoder.pkl")
le_day = joblib.load("day_encoder.pkl")

def predict_crowd(
    zone: str,
    zone_capacity: int,
    tickets_sold: int,
    live_count: int,
    avg_entry_rate: float,
    artist_popularity: int,
    time_to_show_mins: int,
    weather: str = "clear",
    timestamp: str = None
):
    """Return predicted crowd count for a given zone and inputs."""
    if timestamp is None:
        timestamp = datetime.utcnow().isoformat()
    dt = pd.to_datetime(timestamp)
    hour = dt.hour
    minute = dt.minute
    day_of_week = dt.strftime("%A")

    # Encode categoricals
    try:
        zone_enc = le_zone.transform([zone])[0]
    except ValueError:
        zone_enc = 0  # fallback unknown zone
    try:
        weather_enc = le_weather.transform([weather])[0]
    except ValueError:
        weather_enc = 0
    try:
        day_enc = le_day.transform([day_of_week])[0]
    except ValueError:
        day_enc = 0

    # Build feature vector in the same order as training
    features = pd.DataFrame([{
        "zone_capacity": zone_capacity,
        "tickets_sold": tickets_sold,
        "live_count": live_count,
        "avg_entry_rate": avg_entry_rate,
        "artist_popularity": artist_popularity,
        "time_to_show_mins": time_to_show_mins,
        "hour": hour,
        "minute": minute,
        "zone_encoded": zone_enc,
        "weather_encoded": weather_enc,
        "day_encoded": day_enc
    }])

    prediction = model.predict(features)[0]
    return int(round(prediction))
