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

### Installation & Bootstrapping

1. **Create a Python virtual environment (recommended):**
   ```bash
   python -m venv .venv
   .venv\\Scripts\\activate
   ```

2. **Install Python dependencies for the Flask detection API:**
   ```bash
   pip install -r backend/app/requirements.txt
   ```

3. **Download YOLOv8 weights** for your trained crowd and fire/smoke models and place them in `backend/app/models/` using these filenames:
   - `crowd_detection.pt`
   - `fire_smoke_detection.pt`

   The detection code automatically falls back to the repo defaults, but storing the weights in the `models` directory keeps the project portable.

4. **Install Node.js dependencies** (only if you add npm packages; the current static dashboard does not require a build step but Node 18+ is still required to run the proxy server).

### Running the Application

You can start both servers (Flask API + Node proxy) with the helper script:

```bash
start_servers.bat
```

Or run them manually in separate terminals:

1. **Flask detection API (port 5000):**
   ```bash
   cd backend/app
   python api.py
   ```

2. **Node static server + proxy (port 3000):**
   ```bash
   node server.js
   ```

3. Open http://localhost:3000 to access the dashboard. The Node server proxies all `/api/*` calls to the Flask backend running on port 5000.


## 👩‍💻 Author

**Samiksha Walia**
[GitHub](https://github.com/Samiksha-Walia) • [LinkedIn](https://linkedin.com/in/samiksha-walia)



## ⭐️ Show Your Support

If this project helped you or inspired your learning, please give it a ⭐️ on GitHub!

> 📝 *Real-time communication meets file transfer – built with modern web stack and a focus on user experience.*
