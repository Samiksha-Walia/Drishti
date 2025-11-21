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

2. Ensure the YOLOv8 model files are available at the specified paths in `crowd_analysis.py`:
   - Crowd detection model: `D:/Projects/opencv/cctv/runs/detect/drishti_crowd_yolov8s2/weights/best.pt`
   - Fire/smoke detection model: `D:/Projects/Major_project/backend/FireSmoke/best.pt`

   You may need to update these paths based on your actual model locations.

## Usage

### Starting the API Server

Run the Flask API server:

```bash
python api.py
```

The server will start on `http://localhost:5000`.

### API Endpoints

#### POST /api/analyze

Analyzes a video file for crowd, fire, and smoke detection.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with a `file` field containing the video file

**Response:**
```json
{
  "average_people": 15,
  "fire_smoke_predictions": [
    {
      "bbox": [x1, y1, x2, y2],
      "class": "fire",
      "confidence": 0.85
    },
    {
      "bbox": [x1, y1, x2, y2],
      "class": "smoke",
      "confidence": 0.75
    }
  ],
  "sample_frames": ["base64_encoded_image1", "base64_encoded_image2"],
  "message": "Analysis completed successfully using trained models for smoke, fire, and crowd detection."
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