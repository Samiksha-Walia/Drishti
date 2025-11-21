# Project Drishti

Project Drishti is an AI-powered situational awareness platform designed to transform how public safety teams operate.

## Key Features

- Predict crowd bottlenecks 15–20 minutes in advance with Vertex AI Forecasting
- Detect smoke, fire, or panic using live video analysis and Gemini multimodal models
- Summarize real-time security concerns with conversational AI
- Automatically dispatch the nearest response unit via GPS and Google Maps
- Find missing persons using photo matching with Vertex AI Matching Engine

## Tech Stack

- **AI & ML**: Vertex AI Vision, Gemini models, Vertex AI Agent Builder, Vertex AI Matching Engine, Vertex AI Forecasting
- **Frontend**: Firebase Studio (Web), Flutter (Mobile)
- **Backend**: Cloud Functions, Cloud Run, BigQuery, Firestore
- **Maps & Location**: Google Maps SDK

## Project Structure

```
project-drishti/
├── backend/
│   ├── app/                # Local Python backend for crowd and fire/smoke detection
│   │   ├── models/         # YOLOv8 model files
│   │   ├── api.py          # Flask API for video analysis
│   │   └── crowd_analysis.py # Core detection functionality
│   ├── cloud_functions/    # Cloud Functions for Firebase
│   ├── firestore/          # Firestore database schema and rules
│   └── vertex_ai/          # Vertex AI models and configurations
├── frontend/
│   └── web/                # Web application using Firebase Studio
├── mobile/
│   └── flutter/            # Flutter mobile app for field officers
├── docs/                   # Documentation
└── start_servers.bat       # Batch file to start both Node.js and Flask servers
```

## Getting Started

### Prerequisites

- Node.js (for the web server)
- Python 3.8+ (for the crowd and fire/smoke detection)
- YOLOv8 model files (see backend/app/models/README.md)

### Installation

1. Install Node.js dependencies:
   ```
   npm install
   ```

2. Install Python dependencies for crowd and fire/smoke detection:
   ```
   cd backend/app
   pip install -r requirements.txt
   ```

3. Place YOLOv8 model files in the `backend/app/models` directory (see README in that directory)

### Running the Application

You can start both servers (Node.js and Flask) using the provided batch file:

```
start_servers.bat
```

Or start them individually:

1. Start the Flask API server:
   ```
   cd backend/app
   python api.py
   ```

2. Start the Node.js web server:
   ```
   node server.js
   ```

3. Access the application at http://localhost:3000


## 👩‍💻 Author

**Samiksha Walia**
[GitHub](https://github.com/Samiksha-Walia) • [LinkedIn](https://linkedin.com/in/samiksha-walia)



## ⭐️ Show Your Support

If this project helped you or inspired your learning, please give it a ⭐️ on GitHub!

> 📝 *Real-time communication meets file transfer – built with modern web stack and a focus on user experience.*
