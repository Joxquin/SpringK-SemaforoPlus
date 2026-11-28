import io
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import cv2
import numpy as np
import requests
from PIL import Image
from ultralytics import YOLO

IOT_GATEWAY_URL = os.getenv("IOT_GATEWAY_URL", "http://127.0.0.1:8081")
MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8s.pt" if os.path.exists("yolov8s.pt") else "yolov8n.pt")

CAMERAS = [
    ("CAM-01", "Av. Ejército (Norte-Sur)"),
    ("CAM-02", "Calle Los Arces (Este-Oeste)"),
]

MAQUETA_VEHICLE_PROXY_CLASSES = {28, 64, 65, 67}
NATIVE_VEHICLE_CLASSES = {2, 5, 6, 7}

latest_detections = {
    "CAM-01": {"autos": 0, "combis": 0, "unidadesEmergencia": 0, "inferenceLatencyMs": 0, "fps": 0},
    "CAM-02": {"autos": 0, "combis": 0, "unidadesEmergencia": 0, "inferenceLatencyMs": 0, "fps": 0},
}
emergency_override = {"CAM-01": False, "CAM-02": False}


def compute_iou(box_a, box_b):
    x1 = max(box_a[0], box_b[0])
    y1 = max(box_a[1], box_b[1])
    x2 = min(box_a[2], box_b[2])
    y2 = min(box_a[3], box_b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area_a = max(0.0, box_a[2] - box_a[0]) * max(0.0, box_a[3] - box_a[1])
    area_b = max(0.0, box_b[2] - box_b[0]) * max(0.0, box_b[3] - box_b[1])
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def is_valid_maqueta_vehicle(img_np, box):
    h_img, w_img = img_np.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in box]
    bw = max(1, x2 - x1)
    bh = max(1, y2 - y1)
    area_ratio = (bw * bh) / float(h_img * w_img)
    aspect_ratio = bw / float(bh)
    if area_ratio < 0.02 or area_ratio > 0.85:
        return False
    if aspect_ratio < 0.35 or aspect_ratio > 2.8:
        return False
    crop = img_np[max(0, y1):min(h_img, y2), max(0, x1):min(w_img, x2)]
    if crop.size == 0:
        return False
    return float(np.std(crop)) > 14.0


def is_emergency_vehicle(img_bgr, box, cls_id):
    if cls_id == 5:
        return False
    h_img, w_img = img_bgr.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in box]
    crop = img_bgr[max(0, y1):min(h_img, y2), max(0, x1):min(w_img, x2)]
    if crop.size == 0:
        return False
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    total_px = float(crop.shape[0] * crop.shape[1])
    white_mask = (hsv[:, :, 1] < 45) & (hsv[:, :, 2] > 195)
    red_mask_1 = (hsv[:, :, 0] <= 10) & (hsv[:, :, 1] > 110) & (hsv[:, :, 2] > 90)
    red_mask_2 = (hsv[:, :, 0] >= 165) & (hsv[:, :, 1] > 110) & (hsv[:, :, 2] > 90)
    red_ratio = float(np.sum(red_mask_1 | red_mask_2)) / total_px
    white_ratio = float(np.sum(white_mask)) / total_px
    return (white_ratio >= 0.38 and red_ratio >= 0.02) or red_ratio >= 0.35


def process_camera(model, cam_id, avenue_label):
    try:
        resp = requests.get(f"{IOT_GATEWAY_URL}/api/v1/realtime/cam/{cam_id}/raw.jpg", timeout=1.5)
        if resp.status_code != 200 or not resp.content:
            return
    except Exception:
        return

    t0 = time.time()
    try:
        pil_img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception:
        return
    img_rgb = np.array(pil_img)
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    if float(np.mean(gray)) < 20.0 and float(np.std(gray)) < 12.0:
        zero_payload = {
            "camId": cam_id,
            "autos": 0,
            "combis": 0,
            "unidadesEmergencia": 0,
            "fps": 0,
            "inferenceLatencyMs": 0,
            "confidenceAvg": 0.0,
        }
        latest_detections[cam_id] = zero_payload
        try:
            requests.post(f"{IOT_GATEWAY_URL}/api/v1/iot/cam/detection", json=zero_payload, timeout=1.5)
        except Exception:
            pass
        return

    results = model.predict(img_rgb, verbose=False, conf=0.25, imgsz=320)
    detections = []
    if results and len(results) > 0 and results[0].boxes is not None:
        for box in results[0].boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            xyxy = box.xyxy[0].tolist()
            if cls_id in NATIVE_VEHICLE_CLASSES:
                detections.append((xyxy, cls_id, conf, False))
            elif cls_id in MAQUETA_VEHICLE_PROXY_CLASSES and is_valid_maqueta_vehicle(img_rgb, xyxy):
                detections.append((xyxy, 2, conf, True))

    filtered = []
    detections.sort(key=lambda d: (d[3], -d[2]))
    for det in detections:
        if any(compute_iou(det[0], kept[0]) > 0.45 for kept in filtered):
            continue
        filtered.append(det)

    autos = combis = emergencias = 0
    confs = []

    for xyxy, cls_id, conf, _ in filtered:
        confs.append(conf)
        x1, y1, x2, y2 = [int(v) for v in xyxy]
        is_emerg = False
        label = ""
        color = (34, 197, 94)

        if cls_id in {5, 6, 7}:
            combis += 1
            label = f"Combi/Bus {conf:.2f}"
            color = (249, 115, 22)
        elif cls_id == 2:
            if is_emergency_vehicle(img_bgr, xyxy, cls_id):
                emergencias += 1
                is_emerg = True
                label = f"EMERGENCIA {conf:.2f}"
                color = (239, 68, 68)
            else:
                autos += 1
                label = f"Auto {conf:.2f}"

        cv2.rectangle(img_bgr, (x1, y1), (x2, y2), color, 2)
        cv2.putText(img_bgr, label, (x1, max(16, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)
        if is_emerg:
            cv2.rectangle(img_bgr, (x1, y1), (x2, y2), (0, 0, 255), 3)

    if emergency_override.get(cam_id, False):
        emergencias = max(1, emergencias)

    latency_ms = int((time.time() - t0) * 1000)
    fps = int(round(1000.0 / max(1, latency_ms)))
    conf_avg = round(sum(confs) / len(confs), 3) if confs else 0.0

    cv2.rectangle(img_bgr, (0, 0), (img_bgr.shape[1], 24), (20, 20, 20), -1)
    hud = f"{cam_id} | {avenue_label} | V:{autos + combis} | {latency_ms}ms"
    cv2.putText(img_bgr, hud, (6, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)

    ok, encoded = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 82])
    if ok:
        try:
            requests.post(
                f"{IOT_GATEWAY_URL}/api/v1/realtime/cam/{cam_id}/annotated-frame",
                data=encoded.tobytes(),
                headers={"Content-Type": "image/jpeg"},
                timeout=1.5,
            )
        except Exception:
            pass

    payload = {
        "camId": cam_id,
        "autos": autos,
        "combis": combis,
        "unidadesEmergencia": emergencias,
        "fps": min(20, fps),
        "inferenceLatencyMs": latency_ms,
        "confidenceAvg": conf_avg,
    }
    latest_detections[cam_id] = payload

    try:
        requests.post(f"{IOT_GATEWAY_URL}/api/v1/iot/cam/detection", json=payload, timeout=1.5)
    except Exception:
        pass


def run_ml_inference_loop():
    model = YOLO(MODEL_PATH)
    while True:
        for cam_id, avenue in CAMERAS:
            process_camera(model, cam_id, avenue)
        time.sleep(0.01)


class MLStatusHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in {"/", "/status", "/health"}:
            body = json.dumps({
                "service": "ml-vision-service",
                "model": MODEL_PATH,
                "latestDetections": latest_detections,
                "emergencyOverride": emergency_override,
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        cam = qs.get("cam", ["CAM-01"])[0]
        if parsed.path == "/simulate-emergency":
            if cam in emergency_override:
                emergency_override[cam] = True
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"emergency_override_on"}')
        elif parsed.path == "/reset-emergency":
            for k in emergency_override:
                emergency_override[k] = False
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"emergency_override_off"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    t = threading.Thread(target=run_ml_inference_loop, daemon=True)
    t.start()
    server = HTTPServer(("0.0.0.0", 5050), MLStatusHandler)
    server.serve_forever()
