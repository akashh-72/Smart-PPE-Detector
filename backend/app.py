import os
import io
import time
import json
import base64
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, Any, List, Optional

from fastapi import BackgroundTasks, FastAPI, File, UploadFile, Form, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

from config import (
    BASE_DIR,
    SAMPLES_DIR,
    CAPTURES_DIR,
    FACES_DIR,
    DEFAULT_REQUIRED_PPE,
    DEFAULT_THRESHOLDS,
    DEFAULT_FACE_MATCH_THRESHOLD,
)
from ppe_detector import PPEDetector
from face_recognizer import FaceRecognizer
from hardware_controller import get_hardware_controller
from event_logger import event_logger

app = FastAPI(title="AI-Based PPE Verification & Biometric Face Access Control System", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core services (PPEDetector remains 100% untouched)
detector = PPEDetector()
face_recognizer = FaceRecognizer()
hardware = get_hardware_controller()

# Thread pool for blocking inference and IO tasks
_executor = ThreadPoolExecutor(max_workers=4)

# Active WebSocket connections for live digital twin updates
active_websockets: List[WebSocket] = []
main_loop: Optional[asyncio.AbstractEventLoop] = None


@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_running_loop()


def ws_hardware_broadcast(state: Dict[str, Any]):
    global main_loop
    if not active_websockets:
        return

    async def _send(ws: WebSocket, payload: Dict[str, Any]):
        try:
            await ws.send_json(payload)
        except Exception:
            if ws in active_websockets:
                try:
                    active_websockets.remove(ws)
                except ValueError:
                    pass

    target_loop = main_loop
    if not target_loop or target_loop.is_closed():
        try:
            target_loop = asyncio.get_event_loop()
        except Exception:
            target_loop = None

    if target_loop and target_loop.is_running():
        for ws in list(active_websockets):
            try:
                asyncio.run_coroutine_threadsafe(_send(ws, state), target_loop)
            except Exception:
                pass


hardware.subscribe(ws_hardware_broadcast)
try:
    from firebase_sync import sync_hardware_state
    hardware.subscribe(sync_hardware_state)
except Exception:
    pass

# Runtime config state
runtime_config: Dict[str, Any] = {
    "required_items": list(DEFAULT_REQUIRED_PPE),
    "thresholds": dict(DEFAULT_THRESHOLDS),
    "require_face_auth": True,
    "face_threshold": DEFAULT_FACE_MATCH_THRESHOLD,
}


class ScanBase64Request(BaseModel):
    image_base64: str
    required_items: Optional[List[str]] = None


class ConfigUpdateRequest(BaseModel):
    required_items: Optional[List[str]] = None
    thresholds: Optional[Dict[str, float]] = None
    require_face_auth: Optional[bool] = None
    face_threshold: Optional[float] = None


class StaffCreateRequest(BaseModel):
    name: str
    employee_id: str
    department: str
    role: str
    required_ppe: Optional[List[str]] = ["helmet", "vest"]
    face_image_base64: Optional[str] = None
    face_images_base64: Optional[List[str]] = None


class StaffUpdateRequest(BaseModel):
    name: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    required_ppe: Optional[List[str]] = None
    status: Optional[str] = None


class StaffFaceEnrollRequest(BaseModel):
    images_base64: Optional[List[str]] = None
    image_base64: Optional[str] = None
    replace: Optional[bool] = False


class FaceValidateRequest(BaseModel):
    image_base64: str


class ContactRequest(BaseModel):
    name: str
    email: str
    company: Optional[str] = ""
    site_type: Optional[str] = "Industrial Site"
    message: str


class SettingsUpdateRequest(BaseModel):
    settings: Dict[str, Any]


class HardwareConnectRequest(BaseModel):
    port: Optional[str] = None
    baudrate: Optional[int] = 9600


class HardwareTestRequest(BaseModel):
    action: str = "ALLOWED"  # "ALLOWED", "DENIED", "STANDBY", "CUSTOM"
    line1: Optional[str] = None
    line2: Optional[str] = None
    worker_name: Optional[str] = "AKASH"
    worker_role: Optional[str] = "WELDER"
    cause: Optional[str] = "WELCOME"


def _execute_gate_verification(image_bytes: bytes, req_list: List[str]) -> Dict[str, Any]:
    """
    Runs PPE detection (100% untouched) AND simultaneous biometric face recognition
    against all enrolled workers in the directory.
    """
    t0 = time.time()

    # 1. Original PPE Compliance Engine (untouched)
    ppe_analysis = detector.analyze_image(image_bytes, req_list, runtime_config["thresholds"])

    # 2. Simultaneous Biometric Face Recognition Engine
    enrolled_staff = event_logger.get_enrolled_staff_embeddings()
    face_result = face_recognizer.verify_face(
        image_bytes,
        enrolled_staff,
        threshold=float(runtime_config.get("face_threshold", DEFAULT_FACE_MATCH_THRESHOLD)),
    )

    ppe_compliant = bool(ppe_analysis["is_compliant"])
    require_face = bool(runtime_config.get("require_face_auth", True))
    face_authorized = bool(face_result["is_authorized"]) if require_face else True

    final_is_compliant = ppe_compliant and face_authorized
    final_status = "GRANTED" if final_is_compliant else "DENIED"

    denial_reasons: List[str] = []
    if require_face and not face_authorized:
        f_stat = face_result.get("face_status", "UNAUTHORIZED")
        if f_stat == "NO_FACE":
            denial_reasons.append("FACE NOT DETECTED")
        elif f_stat == "SUSPENDED":
            denial_reasons.append("PERMIT SUSPENDED")
        else:
            denial_reasons.append("UNAUTHORIZED PERSON")

    for missing_gear in ppe_analysis.get("missing_items", []):
        denial_reasons.append(missing_gear)

    # Update worker last_access timestamp when identified
    matched_worker = face_result.get("worker")
    if matched_worker and matched_worker.get("id"):
        try:
            event_logger.update_staff_access(int(matched_worker["id"]))
        except Exception:
            pass

    # Overlay face bracket & combined verdict banner onto annotated image
    annotated_with_face = face_recognizer.overlay_face_annotation(
        ppe_analysis.get("annotated_image", ""),
        face_result,
        final_is_compliant=final_is_compliant,
        ppe_missing_items=ppe_analysis.get("missing_items", []),
        require_face_auth=require_face,
    )

    total_ms = round((time.time() - t0) * 1000, 1)

    return {
        **ppe_analysis,
        "status": final_status,
        "is_compliant": final_is_compliant,
        "ppe_is_compliant": ppe_compliant,
        "require_face_auth": require_face,
        "face_recognition": face_result,
        "denial_reasons": denial_reasons,
        "annotated_image": annotated_with_face,
        "inference_time_ms": total_ms,
    }


def _trigger_hardware_for_analysis(background_tasks: BackgroundTasks, analysis: Dict[str, Any]):
    """Triggers servo gate, LEDs, buzzer, and 16x2 LCD based on combined PPE + Face verdict."""
    face_rec = analysis.get("face_recognition") or {}
    worker = face_rec.get("worker")

    if analysis["is_compliant"]:
        first_name = ""
        w_role = ""
        if worker:
            if worker.get("name"):
                first_name = worker["name"].split()[0].upper()
            if worker.get("role"):
                w_role = worker["role"].strip()
        background_tasks.add_task(
            hardware.grant_access, 
            worker_name=first_name, 
            worker_role=w_role, 
            cause="WELCOME"
        )
    else:
        require_face = analysis.get("require_face_auth", True)
        face_ok = face_rec.get("is_authorized", False) if require_face else True
        face_status = face_rec.get("face_status", "")
        missing_ppe = analysis.get("missing_items") or []

        if not face_ok:
            if missing_ppe:
                cause = "NO FACE+NO PPE" if face_status == "NO_FACE" else "UNAUTH + NO PPE"
            elif face_status == "NO_FACE":
                cause = "NO FACE VISIBLE"
            elif face_status == "SUSPENDED":
                cause = "PERMIT REVOKED"
            else:
                cause = "UNAUTHORIZED!"
        else:
            cause = "NO: " + ", ".join(missing_ppe).upper() if missing_ppe else "PPE INCOMPLETE"

        background_tasks.add_task(hardware.deny_access, missing_ppe, cause=cause)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "hardware_mode": hardware.mode,
        "face_recognition_ready": face_recognizer.detector is not None and face_recognizer.recognizer is not None,
        "active_websockets": len(active_websockets),
        "timestamp": time.time(),
    }


@app.get("/api/hardware/state")
def get_hardware_state():
    return hardware.get_state()


@app.get("/api/hardware/ports")
def get_hardware_ports():
    if hasattr(hardware, "get_available_ports"):
        return hardware.get_available_ports()
    return {"ports": [], "current_port": None, "connected": False, "baudrate": 9600}


@app.post("/api/hardware/connect")
def connect_hardware(req: HardwareConnectRequest):
    if hasattr(hardware, "connect_port"):
        success, msg = hardware.connect_port(port=req.port, baudrate=req.baudrate or 9600)
        return {"success": success, "message": msg, "state": hardware.get_state()}
    return {"success": False, "message": "Serial connection not supported by current controller", "state": hardware.get_state()}


@app.post("/api/hardware/test")
def test_hardware(req: HardwareTestRequest):
    act = req.action.upper()
    if act in ("ALLOWED", "GRANTED"):
        hardware.grant_access(
            worker_name=req.worker_name or "AKASH", 
            worker_role=req.worker_role or "WELDER", 
            cause=req.cause or "WELCOME"
        )
    elif act in ("DENIED", "REJECTED"):
        hardware.deny_access(missing_items=["helmet"], cause=req.cause or "NO: HELMET")
    elif act in ("STANDBY", "RESET"):
        hardware.reset_standby()
    elif act == "CUSTOM" and req.line1:
        if hasattr(hardware, "display_custom_lcd"):
            hardware.display_custom_lcd(req.line1, req.line2 or "")
    return {"message": f"Hardware test executed: {act}", "state": hardware.get_state()}


@app.post("/api/hardware/reset")
def reset_hardware():
    hardware.reset_standby()
    return {"message": "Hardware reset to STANDBY", "state": hardware.get_state()}


@app.post("/api/hardware/gate/toggle")
def toggle_gate(action: str = "OPEN"):
    if action.upper() == "OPEN":
        hardware.grant_access(worker_name="WORKER", cause="WELCOME")
    else:
        hardware.reset_standby()
    return {"message": f"Gate set to {action}", "state": hardware.get_state()}


@app.get("/api/config")
def get_config():
    enrolled_count = len(event_logger.get_enrolled_staff_embeddings())
    return {
        "required_items": runtime_config["required_items"],
        "thresholds": runtime_config["thresholds"],
        "require_face_auth": runtime_config["require_face_auth"],
        "face_threshold": runtime_config["face_threshold"],
        "enrolled_faces_count": enrolled_count,
        "all_items": ["helmet", "vest", "mask", "gloves", "shoes"],
    }


@app.post("/api/config")
def update_config(req: ConfigUpdateRequest):
    if req.required_items is not None:
        runtime_config["required_items"] = req.required_items
    if req.thresholds is not None:
        runtime_config["thresholds"].update(req.thresholds)
    if req.require_face_auth is not None:
        runtime_config["require_face_auth"] = bool(req.require_face_auth)
    if req.face_threshold is not None:
        runtime_config["face_threshold"] = max(0.25, min(0.75, float(req.face_threshold)))
    return {"message": "Configuration updated", "config": runtime_config}


@app.post("/api/scan/upload")
@app.post("/api/verify/upload")
async def scan_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    required_items: Optional[str] = Form(None),
):
    """
    Process an uploaded image file (JPEG/PNG/HEIC) for simultaneous PPE & Face Verification.
    """
    content = await file.read()
    req_list = json.loads(required_items) if required_items else runtime_config["required_items"]

    loop = asyncio.get_running_loop()
    analysis = await loop.run_in_executor(
        _executor, lambda: _execute_gate_verification(content, req_list)
    )

    _trigger_hardware_for_analysis(background_tasks, analysis)

    snapshot_filename = f"scan_{int(time.time()*1000)}.jpg"
    background_tasks.add_task(_save_snapshot_and_log, content, analysis, snapshot_filename)

    return {
        **analysis,
        "log_id": None,
        "hardware_state": hardware.get_state(),
    }


@app.post("/api/scan/base64")
@app.post("/api/verify/webcam")
async def scan_base64(
    background_tasks: BackgroundTasks,
    req: ScanBase64Request,
):
    """
    Process a base64 encoded snapshot from the live webcam feed for simultaneous PPE & Face Verification.
    """
    header, b64data = req.image_base64.split(",", 1) if "," in req.image_base64 else ("", req.image_base64)
    image_bytes = base64.b64decode(b64data)
    req_list = req.required_items if req.required_items is not None else runtime_config["required_items"]

    loop = asyncio.get_running_loop()
    analysis = await loop.run_in_executor(
        _executor, lambda: _execute_gate_verification(image_bytes, req_list)
    )

    _trigger_hardware_for_analysis(background_tasks, analysis)

    snapshot_filename = f"scan_{int(time.time()*1000)}.jpg"
    background_tasks.add_task(_save_snapshot_and_log, image_bytes, analysis, snapshot_filename)

    return {
        **analysis,
        "log_id": None,
        "hardware_state": hardware.get_state(),
    }


def _save_snapshot_and_log(image_bytes: bytes, analysis: Dict[str, Any], snapshot_filename: str):
    """Background task: persist snapshot file and write audit log entry with worker identity."""
    snapshot_path = CAPTURES_DIR / snapshot_filename
    try:
        ann = analysis.get("annotated_image", "")
        if ann and "base64," in ann:
            raw_jpg = base64.b64decode(ann.split("base64,", 1)[1])
            with open(snapshot_path, "wb") as f:
                f.write(raw_jpg)
        else:
            with open(snapshot_path, "wb") as f:
                f.write(image_bytes)
    except Exception:
        snapshot_filename = ""

    face_rec = analysis.get("face_recognition") or {}
    worker = face_rec.get("worker") or {}
    face_status = face_rec.get("face_status", "")
    worker_name = worker.get("name", "")
    if not worker_name and face_status == "UNAUTHORIZED":
        worker_name = "Unauthorized Person"
    elif not worker_name and face_status == "NO_FACE":
        worker_name = "Face Not Visible"

    try:
        event_logger.log_scan(
            status=analysis["status"],
            compliance_pct=analysis["compliance_percentage"],
            avg_confidence=analysis["average_confidence"],
            inference_time_ms=analysis["inference_time_ms"],
            compliant_items=analysis["compliant_items"],
            missing_items=analysis["missing_items"],
            detections=analysis["detections"],
            image_filename=snapshot_filename,
            worker_name=worker_name,
            employee_id=worker.get("employee_id", ""),
            face_status=face_status,
            face_confidence=face_rec.get("match_confidence", 0.0),
        )
    except Exception as e:
        print(f"Background log error: {e}")


@app.get("/api/benchmarks")
def list_benchmarks():
    """Returns available pre-loaded benchmark scenarios with metadata."""
    benchmarks = [
        {
            "id": "full_compliant",
            "name": "Full PPE Compliant Worker",
            "description": "Hard Hat + High-Vis Vest + Face Mask + Work Gloves + Safety Boots",
            "expected": "GRANTED",
            "missing": [],
            "image_url": "/api/benchmarks/image/full_compliant.jpg",
        },
        {
            "id": "missing_helmet",
            "name": "Missing Helmet / Hard Hat",
            "description": "Worker has vest, mask, gloves and boots, but no protective hard hat",
            "expected": "DENIED",
            "missing": ["helmet"],
            "image_url": "/api/benchmarks/image/missing_helmet.jpg",
        },
        {
            "id": "missing_vest",
            "name": "Missing High-Vis Vest",
            "description": "Worker wearing plain dark shirt without high-visibility reflective vest",
            "expected": "DENIED",
            "missing": ["vest"],
            "image_url": "/api/benchmarks/image/missing_vest.jpg",
        },
        {
            "id": "missing_mask",
            "name": "Missing Face Mask",
            "description": "Worker with helmet, vest, gloves and boots, but unmasked mouth/nose",
            "expected": "DENIED",
            "missing": ["mask"],
            "image_url": "/api/benchmarks/image/missing_mask.jpg",
        },
        {
            "id": "missing_gloves",
            "name": "Missing Safety Gloves",
            "description": "Worker wearing bare hands without cut-resistant safety work gloves",
            "expected": "DENIED",
            "missing": ["gloves"],
            "image_url": "/api/benchmarks/image/missing_gloves.jpg",
        },
        {
            "id": "missing_shoes",
            "name": "Non-Compliant Footwear",
            "description": "Worker wearing casual open footwear / flip-flops without steel-toe boots",
            "expected": "DENIED",
            "missing": ["shoes"],
            "image_url": "/api/benchmarks/image/missing_shoes.jpg",
        },
    ]
    return benchmarks


@app.get("/api/benchmarks/image/{filename}")
def get_benchmark_image(filename: str):
    file_path = SAMPLES_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Benchmark image not found")
    return FileResponse(file_path, media_type="image/jpeg")


@app.post("/api/benchmarks/run/{scenario_id}")
@app.post("/api/verify/benchmark/{scenario_id}")
async def run_benchmark(scenario_id: str, background_tasks: BackgroundTasks):
    file_path = SAMPLES_DIR / f"{scenario_id}.jpg"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Benchmark scenario not found")

    image_bytes = file_path.read_bytes()
    req_list = runtime_config["required_items"]

    loop = asyncio.get_running_loop()
    analysis = await loop.run_in_executor(
        _executor, lambda: detector.analyze_image(image_bytes, req_list, runtime_config["thresholds"])
    )

    # Synthetic benchmark diagrams carry simulated worker identity so PPE benchmarks remain untouched
    analysis["ppe_is_compliant"] = analysis["is_compliant"]
    analysis["require_face_auth"] = False
    analysis["denial_reasons"] = list(analysis["missing_items"])
    analysis["face_recognition"] = {
        "face_detected": True,
        "face_status": "AUTHORIZED",
        "is_authorized": True,
        "simulated": True,
        "worker": {
            "id": 1,
            "name": "Alex Vance (Simulated)",
            "employee_id": "EMP-1042",
            "department": "Construction Operations",
            "role": "Site Engineer",
            "status": "ACTIVE",
            "face_image": "",
        },
        "similarity_score": 0.89,
        "match_confidence": 98.4,
        "face_confidence": 0.99,
        "bbox": [0, 0, 0, 0],
        "enrolled_workers_count": len(event_logger.get_enrolled_staff_embeddings()),
        "message": "Simulated Benchmark Identity: Alex Vance (EMP-1042)",
    }

    if analysis["is_compliant"]:
        background_tasks.add_task(hardware.grant_access, worker_name="ALEX", worker_role="WORKER", cause="WELCOME")
    else:
        cause = "NO: " + ", ".join(analysis["missing_items"]).upper() if analysis.get("missing_items") else "PPE INCOMPLETE"
        background_tasks.add_task(hardware.deny_access, analysis["missing_items"], cause=cause)

    snapshot_filename = f"bench_{int(time.time()*1000)}.jpg"
    background_tasks.add_task(_save_snapshot_and_log, image_bytes, analysis, snapshot_filename)

    return {
        **analysis,
        "log_id": None,
        "hardware_state": hardware.get_state(),
    }


@app.get("/api/logs")
def get_logs(limit: int = 30):
    return event_logger.get_recent_logs(limit=limit)


@app.get("/api/stats")
def get_statistics():
    return event_logger.get_statistics()


@app.post("/api/logs/clear")
def clear_all_logs():
    event_logger.clear_logs()
    return {"message": "Logs cleared"}


@app.get("/api/logs/export")
def export_logs_csv():
    from fastapi.responses import Response
    csv_data = event_logger.export_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ppe_access_logs.csv"},
    )


# --- Staff & Biometric Face Enrollment Endpoints ---
@app.get("/api/staff")
def get_staff_members():
    return event_logger.get_all_staff()


@app.post("/api/face/validate")
async def validate_face_capture(req: FaceValidateRequest):
    """Validates a live webcam or photo frame for clear biometric face visibility."""
    loop = asyncio.get_running_loop()
    try:
        sample = await loop.run_in_executor(
            _executor, lambda: face_recognizer.validate_and_extract(req.image_base64)
        )
        return {
            "valid": True,
            "avatar_data_url": sample["avatar_data_url"],
            "face_confidence": sample["face_confidence"],
            "bbox": sample["bbox"],
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Face validation failed: {e}")


@app.post("/api/staff")
async def create_staff_member(req: StaffCreateRequest):
    """Creates a new worker and optionally enrolls their biometric face data simultaneously."""
    face_inputs: List[str] = []
    if req.face_images_base64:
        face_inputs.extend([img for img in req.face_images_base64 if img])
    elif req.face_image_base64:
        face_inputs.append(req.face_image_base64)

    embeddings: Optional[List[List[float]]] = None
    face_image_url = ""
    avatar_bytes: Optional[bytes] = None

    if face_inputs:
        loop = asyncio.get_running_loop()
        try:
            enrollment = await loop.run_in_executor(
                _executor, lambda: face_recognizer.extract_multi_enrollment(face_inputs)
            )
            embeddings = enrollment["embeddings"]
            face_image_url = enrollment["avatar_data_url"]
            avatar_bytes = enrollment["avatar_bytes"]
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

    try:
        created = event_logger.add_staff(
            name=req.name,
            employee_id=req.employee_id,
            department=req.department,
            role=req.role,
            required_ppe=req.required_ppe or ["helmet", "vest"],
            face_embeddings=embeddings,
            face_image=face_image_url,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    if avatar_bytes and created.get("id"):
        try:
            face_file = FACES_DIR / f"staff_{created['id']}.jpg"
            face_file.write_bytes(avatar_bytes)
        except Exception:
            pass

    return created


@app.post("/api/staff/{staff_id}/face")
async def enroll_existing_staff_face(staff_id: int, req: StaffFaceEnrollRequest):
    """Scans or updates biometric face data (1 or multiple shots) for an existing worker."""
    face_inputs: List[str] = []
    if req.images_base64:
        face_inputs.extend([img for img in req.images_base64 if img])
    if req.image_base64:
        face_inputs.append(req.image_base64)

    if not face_inputs:
        raise HTTPException(status_code=400, detail="No face image provided for enrollment.")

    loop = asyncio.get_running_loop()
    try:
        enrollment = await loop.run_in_executor(
            _executor, lambda: face_recognizer.extract_multi_enrollment(face_inputs)
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    try:
        updated = event_logger.enroll_staff_face(
            staff_id=staff_id,
            embeddings=enrollment["embeddings"],
            face_image=enrollment["avatar_data_url"],
            replace=bool(req.replace),
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

    try:
        face_file = FACES_DIR / f"staff_{staff_id}.jpg"
        face_file.write_bytes(enrollment["avatar_bytes"])
    except Exception:
        pass

    return {
        "message": f"Face biometric data enrolled for {updated['name']}",
        "staff": updated,
        "face_confidence": enrollment["face_confidence"],
    }


@app.post("/api/staff/{staff_id}/face/upload")
async def enroll_existing_staff_face_upload(
    staff_id: int,
    file: UploadFile = File(...),
    replace: bool = Form(False),
):
    """Enrolls or updates biometric face data for an existing worker from an uploaded photo."""
    content = await file.read()
    loop = asyncio.get_running_loop()
    try:
        enrollment = await loop.run_in_executor(
            _executor, lambda: face_recognizer.extract_multi_enrollment([content])
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    try:
        updated = event_logger.enroll_staff_face(
            staff_id=staff_id,
            embeddings=enrollment["embeddings"],
            face_image=enrollment["avatar_data_url"],
            replace=bool(replace),
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

    try:
        face_file = FACES_DIR / f"staff_{staff_id}.jpg"
        face_file.write_bytes(enrollment["avatar_bytes"])
    except Exception:
        pass

    return {
        "message": f"Face photo enrolled for {updated['name']}",
        "staff": updated,
        "face_confidence": enrollment["face_confidence"],
    }


@app.delete("/api/staff/{staff_id}/face")
def delete_existing_staff_face(staff_id: int):
    try:
        updated = event_logger.clear_staff_face(staff_id)
        face_file = FACES_DIR / f"staff_{staff_id}.jpg"
        if face_file.exists():
            face_file.unlink()
        return {"message": "Face biometric data cleared", "staff": updated}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@app.put("/api/staff/{staff_id}")
def update_staff_member(staff_id: int, req: StaffUpdateRequest):
    """Updates an existing employee's details (designation, department, name, ppe, status)."""
    try:
        updated = event_logger.update_staff(
            staff_id=staff_id,
            name=req.name,
            employee_id=req.employee_id,
            department=req.department,
            role=req.role,
            required_ppe=req.required_ppe,
            status=req.status,
        )
        return updated
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update worker: {e}")


@app.delete("/api/staff/{staff_id}")
def remove_staff_member(staff_id: int):
    event_logger.delete_staff(staff_id)
    try:
        face_file = FACES_DIR / f"staff_{staff_id}.jpg"
        if face_file.exists():
            face_file.unlink()
    except Exception:
        pass
    return {"message": f"Staff member {staff_id} removed"}


@app.post("/api/staff/{staff_id}/toggle")
def toggle_staff_member_status(staff_id: int):
    return event_logger.toggle_staff_status(staff_id)


# System Settings Endpoints
@app.get("/api/system/settings")
def get_system_settings():
    return event_logger.get_settings()


@app.post("/api/system/settings")
def update_system_settings(req: SettingsUpdateRequest):
    event_logger.save_settings(req.settings)
    return {"message": "Settings updated", "settings": event_logger.get_settings()}


# Contact & Enterprise Inquiry Endpoint
@app.post("/api/contact")
def submit_contact_inquiry(req: ContactRequest):
    inquiry_id = event_logger.save_contact(
        name=req.name,
        email=req.email,
        company=req.company or "",
        site_type=req.site_type or "Industrial Site",
        message=req.message,
    )
    return {"message": "Inquiry recorded successfully", "id": inquiry_id}


@app.websocket("/ws/hardware")
async def websocket_hardware_endpoint(websocket: WebSocket):
    global main_loop
    if not main_loop or main_loop.is_closed():
        main_loop = asyncio.get_running_loop()
    await websocket.accept()
    active_websockets.append(websocket)
    # Send immediate state on connect
    await websocket.send_json(hardware.get_state())
    try:
        while True:
            # Keep alive and receive any client ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except (WebSocketDisconnect, Exception):
        if websocket in active_websockets:
            active_websockets.remove(websocket)


# Serve Captured Images, Face Portraits & Frontend Static Files
FRONTEND_DIR = BASE_DIR / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
app.mount("/data/captures", StaticFiles(directory=str(CAPTURES_DIR)), name="captures")
app.mount("/data/faces", StaticFiles(directory=str(FACES_DIR)), name="faces")

if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="frontend")
else:
    if (FRONTEND_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
