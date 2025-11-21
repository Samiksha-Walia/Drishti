from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import base64, tempfile, os
from bothCSF import analyze_frame


app = FastAPI(title="Project Drishti API 🚀")

# Allow React frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for local testing, later limit it
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "✅ Project Drishti Backend Running"}

@app.post("/analyze/")
async def analyze(file: UploadFile = File(...)):
    """
    Upload an image and perform people + fire/smoke detection
    """
    contents = await file.read()
    npimg = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    results = analyze_frame(frame)

    # Encode annotated frame to Base64
    _, buffer = cv2.imencode(".jpg", results["frame"])
    encoded_image = base64.b64encode(buffer).decode("utf-8")

    return {
        "people_count": results["people_count"],
        "fire_smoke_predictions": results["fire_smoke_predictions"],
        "image": encoded_image
    }


@app.post("/analyze-video/")
async def analyze_video(file: UploadFile = File(...)):
    """
    Upload a video and analyze each frame for people + fire/smoke
    Returns the processed video as base64.
    """
    # Save uploaded video temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    cap = cv2.VideoCapture(tmp_path)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out_path = tmp_path.replace(".mp4", "_out.mp4")
    out = None

    frame_count, people_sum = 0, 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        results = analyze_frame(frame)
        people_sum += results["people_count"]

        if out is None:
            h, w, _ = frame.shape
            out = cv2.VideoWriter(out_path, fourcc, 20.0, (w, h))
        out.write(results["frame"])

    if cap is not None and cap.isOpened():
        cap.release()
    if out is not None:
        out.release()


    avg_people = people_sum // max(1, frame_count)

    # Convert processed video to base64
    with open(out_path, "rb") as f:
        video_bytes = f.read()
    encoded_video = base64.b64encode(video_bytes).decode("utf-8")

    os.remove(tmp_path)
    os.remove(out_path)

    return {
        "average_people": avg_people,
        "message": f"Processed {frame_count} frames",
        "video": encoded_video
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)