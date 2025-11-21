# Project Drishti - Frontend and Backend Integration

## Overview

This document explains how the frontend and backend components of Project Drishti are integrated. The project uses a Node.js server to serve the frontend files and proxy API requests to the FastAPI backend.

## Architecture

1. **Frontend**: React-based web application served by Node.js
2. **Backend**: FastAPI application for image and video analysis
3. **Integration**: Node.js server proxies API requests to FastAPI

## Components

### Frontend (React)

- Located in `frontend/web/`
- Key files:
  - `cameras.html`: Camera analysis interface that sends video files to the backend
  - Other HTML files for different sections of the application

### Backend (FastAPI)

- Located in `backend/app/`
- Key files:
  - `fastapi_app.py`: FastAPI application with endpoints for image and video analysis
  - `bothCSF.py`: Contains the `analyze_frame` function for crowd and fire/smoke detection

### Integration Server (Node.js)

- Located in the project root
- Key file:
  - `server.js`: Node.js server that serves frontend files and proxies API requests

## How It Works

1. The Node.js server starts the FastAPI backend and serves the frontend files
2. When a user uploads a video in the frontend, the request is sent to `/api/analyze-video/`
3. The Node.js server proxies this request to the FastAPI backend at `http://localhost:8000/analyze-video/`
4. The FastAPI backend processes the video and returns the analysis results
5. The frontend displays the results to the user

## Running the Application

1. Start the application by running `node server.js` in the project root
2. This will automatically start the FastAPI backend and serve the frontend
3. Access the application at `http://localhost:3000`

## API Endpoints

### FastAPI Backend

- `/`: Root endpoint that returns a welcome message
- `/analyze/`: Analyzes an image for people and fire/smoke
- `/analyze-video/`: Analyzes a video for people and fire/smoke

### Frontend to Backend Communication

The frontend communicates with the backend through the Node.js proxy:

- Frontend requests to `/api/analyze-video/` are proxied to `http://localhost:8000/analyze-video/`

## Troubleshooting

- If the FastAPI server fails to start automatically, you can start it manually:
  ```
  cd backend/app
  python -m uvicorn fastapi_app:app --host 0.0.0.0 --port 8000
  ```

- If you encounter CORS issues, ensure that the FastAPI backend has CORS middleware enabled

## Future Improvements

1. Add authentication and authorization
2. Implement real-time analysis using WebSockets
3. Add more analysis features and visualization options