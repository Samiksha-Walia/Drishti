import requests
import os
import sys
import time

# API endpoint URL
API_URL = "http://localhost:5000/api/analyze"

def test_api(video_path):
    """Test the crowd and fire/smoke detection API with a video file"""
    if not os.path.exists(video_path):
        print(f"Error: Video file not found at {video_path}")
        return
    
    print(f"Testing API with video: {video_path}")
    
    # Prepare the file for upload
    files = {'file': open(video_path, 'rb')}
    
    try:
        # Start timer
        start_time = time.time()
        
        # Send the request
        print("Sending request to API...")
        response = requests.post(API_URL, files=files)
        
        # End timer
        elapsed_time = time.time() - start_time
        
        # Check response
        if response.status_code == 200:
            result = response.json()
            print("\n✅ API test successful!")
            print(f"⏱️ Processing time: {elapsed_time:.2f} seconds")
            print(f"👥 Average people detected: {result['average_people']}")
            print(f"🔥 Fire/Smoke incidents: {len(result['fire_smoke_predictions'])}")
            
            # Print fire/smoke details if any
            if result['fire_smoke_predictions']:
                print("\nFire/Smoke Detections:")
                for i, pred in enumerate(result['fire_smoke_predictions']):
                    print(f"  {i+1}. {pred['class']} - Confidence: {pred['confidence']:.2f}")
            
            # Print sample frames info
            if 'sample_frames' in result and result['sample_frames']:
                print(f"\nReceived {len(result['sample_frames'])} sample frames with detections")
            
            print(f"\nMessage: {result['message']}")
        else:
            print(f"\n❌ API test failed with status code: {response.status_code}")
            print(f"Error: {response.text}")
    
    except requests.exceptions.ConnectionError:
        print("\n❌ Connection error: Failed to connect to the API server")
        print("Make sure the Flask API server is running (python api.py)")
    
    except Exception as e:
        print(f"\n❌ Error during API test: {str(e)}")
    
    finally:
        # Close the file
        files['file'].close()

def main():
    # Check if video path is provided as command line argument
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
    else:
        # Default test video path - replace with your test video
        video_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "test_video.mp4")
        
        # If default video doesn't exist, prompt user
        if not os.path.exists(video_path):
            print(f"Default test video not found at: {video_path}")
            video_path = input("Enter the path to a test video file: ")
    
    test_api(video_path)

if __name__ == "__main__":
    main()