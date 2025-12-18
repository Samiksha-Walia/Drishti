import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

# Load dataset
df = pd.read_csv("concert_crowd_dataset.csv")

# Extract time features
df["hour"] = pd.to_datetime(df["timestamp"]).dt.hour
df["minute"] = pd.to_datetime(df["timestamp"]).dt.minute

# Encode categorical columns
le_zone = LabelEncoder()
df["zone_encoded"] = le_zone.fit_transform(df["zone"])

le_weather = LabelEncoder()
df["weather_encoded"] = le_weather.fit_transform(df["weather"])

le_day = LabelEncoder()
df["day_encoded"] = le_day.fit_transform(df["day_of_week"])

# Features for predicting future crowd count:
features = [
    "zone_capacity", "tickets_sold", "live_count", 
    "avg_entry_rate", "artist_popularity", "time_to_show_mins",
    "hour", "minute",
    "zone_encoded", "weather_encoded", "day_encoded"
]

X = df[features]
y = df["predicted_count"]

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train Model
model = RandomForestRegressor(n_estimators=300, random_state=42)
model.fit(X_train, y_train)

# Evaluate
preds = model.predict(X_test)
print("MAE:", mean_absolute_error(y_test, preds))
print("R2 Score:", r2_score(y_test, preds))

# Save Model
joblib.dump(model, "crowd_prediction_model.pkl")
joblib.dump(le_zone, "zone_encoder.pkl")
joblib.dump(le_weather, "weather_encoder.pkl")
joblib.dump(le_day, "day_encoder.pkl")

print("Model training complete and saved!")
