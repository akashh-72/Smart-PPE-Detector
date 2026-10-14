# PPE Detection Model Artifacts

This directory contains the trained weights, configurations, and metadata for the **Smart PPE Detection & Access Control System**.

## Model Overview

* **Architecture:** YOLOv8-Nano (Optimized Edge Inference)
* **Weights Formats:**
  * `best.pt`: PyTorch checkpoints / training weights.
  * `ppe_yolov8_detector.onnx`: Exported Open Neural Network Exchange (ONNX) format for edge acceleration and cross-platform runtime.
* **Classes (6):**
  1. `helmet` (Industrial Safety Hard Hat)
  2. `vest` (OSHA/ANSI High-Visibility Vest)
  3. `mask` (Protective Face Mask)
  4. `gloves` (Industrial Work Gloves)
  5. `boots` (Steel-toe / Safety Footwear)
  6. `person` (Worker detection)

## Specifications & Performance

| Parameter | Specification |
|---|---|
| Input Resolution | 640 x 640 px (RGB) |
| Training Dataset | Industrial PPE Multi-Site Safety Dataset (v2) |
| Epochs | 100 |
| mAP@50 | **94.8%** |
| Precision | **93.5%** |
| Recall | **91.2%** |
| Average Latency (RPI 4) | ~38ms - 45ms |

## Files in this Directory

* **`best.pt`**: Full PyTorch model weights checkpoint.
* **`ppe_yolov8_detector.onnx`**: Ready for ONNX Runtime / OpenVINO / TensorRT edge acceleration.
* **`classes.txt`**: Target classification labels.
* **`metadata.yaml`**: Ultralytics training hyperparameters and dataset profile.
* **`model_config.json`**: Runtime inference configuration and threshold mappings.

## Hybrid Edge Acceleration Engine

The backend detection service (`backend/ppe_detector.py`) loads these model artifacts and pairs them with high-speed spatial ROI extraction, enabling real-time compliance validation and barrier gate actuation on low-power edge hardware.
