# Project Drishti FastAPI Backend

This is the FastAPI implementation for Project Drishti's backend, providing endpoints for crowd analysis and fire/smoke detection.

## Features

- Image analysis for people counting and fire/smoke detection
- Video analysis with frame-by-frame processing
- RESTful API with automatic documentation

## Prerequisites

- Python 3.8 or higher
- YOLOv8 models for crowd detection and fire/smoke detection

## Installation

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

2. Ensure the YOLOv8 models are available in the `models` directory:
   - `models/crowd_detection.pt` - YOLOv8 model for crowd detection
   - `models/fire_smoke_detection.pt` - YOLOv8 model for fire/smoke detection

## Running the API

### Using the batch file

Simply run the `start_fastapi.bat` file:

```bash
start_fastapi.bat
```

### Using Python directly

```bash
python -m uvicorn fastapi_app:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000

## API Documentation

Once the server is running, you can access the automatic API documentation at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### GET /

Root endpoint that returns a simple status message.

**Response:**
```json
{
  "message": "✅ Project Drishti Backend Running"
}
```

### POST /analyze/

Analyze an image for people counting and fire/smoke detection.

**Request:**
- Form data with a file field named `file` containing the image to analyze

**Response:**
```json
{
  "people_count": 3,
  "fire_smoke_predictions": [
    {
      "bbox": [100, 200, 300, 400],
      "class": "fire",
      "confidence": 0.85
    }
  ],
  "image": "base64_encoded_image_data"
}
```

### POST /analyze-video/

Analyze a video for people counting and fire/smoke detection.

**Request:**
- Form data with a file field named `file` containing the video to analyze

**Response:**
```json
{
  "average_people": 2,
  "message": "Processed 120 frames",
  "video": "base64_encoded_video_data"
}
```

## Testing

You can test the API using the provided `test_fastapi.py` script:

```bash
python test_fastapi.py
```

This will test the root endpoint and the image analysis endpoint. To test the video analysis endpoint, uncomment the relevant line in the script.

## Integration with Frontend

To integrate with a frontend application, make HTTP requests to the API endpoints. For example, using JavaScript fetch:

```javascript
// Example: Analyzing an image
async function analyzeImage(imageFile) {
  const formData = new FormData();
  formData.append('file', imageFile);
  
  const response = await fetch('http://localhost:8000/analyze/', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  return result;
}
```

## License

This project is part of Project Drishti and is subject to its licensing terms.