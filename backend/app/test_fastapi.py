import requests
import os
import time

# Test the FastAPI endpoints

def test_root():
    """Test the root endpoint"""
    response = requests.get("http://localhost:8000/")
    print(f"Root endpoint response: {response.json()}")
    assert response.status_code == 200

def test_analyze_image():
    """Test the image analysis endpoint"""
    # Path to a test image
    test_image_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'test_image.jpg')
    
    # If test image doesn't exist in models directory, try default path
    if not os.path.exists(test_image_path):
        test_image_path = r"D:/Projects/Major_project/backend/fire.png"
    
    if not os.path.exists(test_image_path):
        print(f"❌ Error: Test image not found at {test_image_path}!")
        return
    
    print(f"Using test image: {test_image_path}")
    
    # Send the image for analysis
    with open(test_image_path, 'rb') as f:
        files = {'file': f}
        start_time = time.time()
        response = requests.post("http://localhost:8000/analyze/", files=files)
        end_time = time.time()
    
    print(f"Analysis took {end_time - start_time:.2f} seconds")
    
    if response.status_code == 200:
        result = response.json()
        print(f"👥 People detected: {result['people_count']}")
        print(f"🔥 Fire/Smoke detections: {result['fire_smoke_predictions']}")
        print(f"Image data received: {len(result['image'])} characters")
    else:
        print(f"❌ Error: {response.status_code} - {response.text}")

def test_analyze_video():
    """Test the video analysis endpoint"""
    # Path to a test video
    test_video_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'test_video.mp4')
    
    if not os.path.exists(test_video_path):
        print(f"❌ Error: Test video not found at {test_video_path}!")
        return
    
    print(f"Using test video: {test_video_path}")
    
    # Send the video for analysis
    with open(test_video_path, 'rb') as f:
        files = {'file': f}
        start_time = time.time()
        response = requests.post("http://localhost:8000/analyze-video/", files=files)
        end_time = time.time()
    
    print(f"Video analysis took {end_time - start_time:.2f} seconds")
    
    if response.status_code == 200:
        result = response.json()
        print(f"👥 Average people detected: {result['average_people']}")
        print(f"✅ Message: {result['message']}")
        print(f"Video data received: {len(result['video'])} characters")
    else:
        print(f"❌ Error: {response.status_code} - {response.text}")

if __name__ == "__main__":
    print("Testing FastAPI endpoints...")
    test_root()
    test_analyze_image()
    # Uncomment to test video analysis (requires a test video)
    # test_analyze_video()
    print("Testing complete!")