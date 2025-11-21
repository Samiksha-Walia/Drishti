from ultralytics import YOLO 
import cv2 


# Load both YOLOv8 custom models
import os

# Define model paths - using absolute paths as fallback, but prefer models in the models directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

# Default model paths (original locations)
DEFAULT_CROWD_MODEL = r"D:/Projects/opencv/cctv/runs/detect/drishti_crowd_yolov8s2/weights/best.pt"
DEFAULT_FIRE_SMOKE_MODEL = r"D:/Projects/Major_project/backend/FireSmoke/best.pt"

# Check if models exist in the models directory
CROWD_MODEL_PATH = os.path.join(MODELS_DIR, 'crowd_detection.pt')
FIRE_SMOKE_MODEL_PATH = os.path.join(MODELS_DIR, 'fire_smoke_detection.pt')

# Use models from models directory if they exist, otherwise use default paths
crowd_model_path = CROWD_MODEL_PATH if os.path.exists(CROWD_MODEL_PATH) else DEFAULT_CROWD_MODEL
fire_smoke_model_path = FIRE_SMOKE_MODEL_PATH if os.path.exists(FIRE_SMOKE_MODEL_PATH) else DEFAULT_FIRE_SMOKE_MODEL

print(f"Loading crowd detection model from: {crowd_model_path}")
print(f"Loading fire/smoke detection model from: {fire_smoke_model_path}")

# Load the models
crowd_model = YOLO(crowd_model_path) 
fire_smoke_model = YOLO(fire_smoke_model_path)


def analyze_frame(frame, conf_threshold=0.5): 
    """ 
    Detects people, fire, and smoke in a frame using two YOLOv8 models. 
    """ 
    # ---------- 1️⃣ Crowd (People) Detection ---------- 
    crowd_results = crowd_model(frame, conf=conf_threshold) 
    people = [] 


    for result in crowd_results: 
        for box in result.boxes: 
            cls = int(box.cls[0]) 
            conf = float(box.conf[0]) 
            if cls == 0 or cls == 1:  # depends on your dataset (0=person or 1=person) 
                x1, y1, x2, y2 = map(int, box.xyxy[0]) 
                people.append({"bbox": [x1, y1, x2, y2], "confidence": conf}) 
                # Draw people bounding boxes 
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2) 
                cv2.putText(frame, f"Person {conf*100:.0f}%", (x1, y1-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2) 


    # ---------- 2️⃣ Fire/Smoke Detection ---------- 
    fire_smoke_results = fire_smoke_model(frame, conf=conf_threshold) 
    fire_smoke_preds = [] 


    for result in fire_smoke_results: 
        for box in result.boxes: 
            cls = int(box.cls[0]) 
            conf = float(box.conf[0]) 
            label = result.names[cls]  # get class name (e.g. 'fire', 'smoke') 
            x1, y1, x2, y2 = map(int, box.xyxy[0]) 


            # Choose color based on class 
            color = (0, 0, 255) if "fire" in label.lower() else (0, 165, 255) 


            fire_smoke_preds.append({ 
                "bbox": [x1, y1, x2, y2], 
                "class": label, 
                "confidence": conf 
            }) 


            # Draw bounding boxes for fire/smoke 
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2) 
            cv2.putText(frame, f"{label} {conf*100:.0f}%", (x1, y1-10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2) 


    # ---------- 3️⃣ Combine Results ---------- 
    return { 
        "frame": frame, 
        "people_count": len(people), 
        "people_detections": people, 
        "fire_smoke_predictions": fire_smoke_preds 
    } 


if __name__ == "__main__": 
    # Use a test image in the models directory if available, otherwise use the default path
    test_image_path = os.path.join(MODELS_DIR, 'test_image.jpg')
    default_test_image = r"D:/Projects/Major_project/backend/fire.png"
    
    # Use the test image if it exists, otherwise use the default path
    if not os.path.exists(test_image_path):
        print(f"Test image not found at {test_image_path}, using default path: {default_test_image}")
        test_image_path = default_test_image
    
    frame = cv2.imread(test_image_path) 


    if frame is None: 
        print(f"❌ Error: Image not found at {test_image_path}!") 
    else: 
        results = analyze_frame(frame) 
        print(f"👥 People detected: {results['people_count']}") 
        print("🔥 Fire/Smoke detections:", results["fire_smoke_predictions"]) 


        # Display annotated result 
        #cv2.imshow("Crowd + Fire/Smoke Detection", results["frame"]) 


        import matplotlib.pyplot as plt 


        # Instead of cv2.imshow(...) 
        plt.imshow(cv2.cvtColor(results["frame"], cv2.COLOR_BGR2RGB)) 
        plt.title("Crowd + Fire/Smoke Detection") 
        plt.axis("off") 
        plt.show() 
        cv2.waitKey(0) 
        cv2.destroyAllWindows()