# Crowd and Fire/Smoke Detection Module

This module provides AI-powered detection of people, fire, and smoke in video streams using YOLOv8 models.

## Features

- **Crowd Detection**: Identifies and counts people in video frames
- **Fire Detection**: Detects fire incidents in video frames
- **Smoke Detection**: Identifies smoke in video frames
- **REST API**: Exposes detection capabilities through a Flask API

## Setup

### Prerequisites

- Python 3.8 or higher
- CUDA-compatible GPU (recommended for faster inference)

### Installation

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

2. Place your trained YOLOv8 weight files in the `models` directory alongside this README:
   - `backend/app/models/crowd_detection.pt`
   - `backend/app/models/fire_smoke_detection.pt`

   The `bothCSF.py` helper automatically loads models from this directory and only falls back to the legacy absolute paths if the files are missing. Keeping the weights here makes the project portable.

## Usage

### Starting the API Server

Run the Flask API server:

```bash
python api.py
```

The server will start on `http://localhost:5000`.

### API Endpoints

| Method | Path                | Description                                      |
|--------|---------------------|--------------------------------------------------|
| GET    | `/api/health`       | Basic health probe for orchestrators/monitors.  |
| POST   | `/api/analyze-image`| Analyze a single image frame and return people/fire/smoke detections plus the annotated frame as base64. |
| POST   | `/api/analyze-video/` (alias `/api/analyze`) | Analyze a video upload by sampling frames, counting people, aggregating fire/smoke detections, and returning sample annotated frames. |

All upload endpoints expect `multipart/form-data` with a `file` field.

#### Sample video response

```json
{
  "average_people": 18,
  "fire_smoke_predictions": [
    { "bbox": [100, 120, 220, 360], "class": "fire", "confidence": 0.87 }
  ],
  "sample_frames": ["base64_encoded_jpeg"],
  "message": "Analysis completed on 6 sampled frames."
}
```

## Integration with Frontend

The frontend can send video files to the API endpoint and display the results, including:

- Average number of people detected
- Fire and smoke incidents with confidence scores
- Sample frames with detection visualizations

## Testing

You can test the crowd analysis module directly by running:

```bash
python crowd_analysis.py
```

This will analyze a test image and display the results using matplotlib.