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
    DEFAULT_REQUIRED_PPE,
    DEFAULT_THRESHOLDS,
)
from ppe_detector import PPEDetector
from hardware_controller import get_hardware_controller
from event_logger import event_logger

app = FastAPI(title="AI-Based PPE Verification & Access Control System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core services
detector = PPEDetector()
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
runtime_config = {
    "required_items": list(DEFAULT_REQUIRED_PPE),
    "thresholds": dict(DEFAULT_THRESHOLDS),
}


class ScanBase64Request(BaseModel):
    image_base64: str
    required_items: Optional[List[str]] = None


class ConfigUpdateRequest(BaseModel):
    required_items: Optional[List[str]] = None
    thresholds: Optional[Dict[str, float]] = None


class StaffCreateRequest(BaseModel):
    name: str
    employee_id: str
    department: str
    role: str
    required_ppe: Optional[List[str]] = ["helmet", "vest"]


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
    worker_name: Optional[str] = "WORKER"
    cause: Optional[str] = "WELCOME"


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "hardware_mode": hardware.mode,
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
        hardware.grant_access(worker_name=req.worker_name or "WORKER", cause=req.cause or "WELCOME")
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
    return {
        "required_items": runtime_config["required_items"],
        "thresholds": runtime_config["thresholds"],
        "all_items": ["helmet", "vest", "mask", "gloves", "shoes"],
    }


@app.post("/api/config")
def update_config(req: ConfigUpdateRequest):
    if req.required_items is not None:
        runtime_config["required_items"] = req.required_items
    if req.thresholds is not None:
        runtime_config["thresholds"].update(req.thresholds)
    return {"message": "Configuration updated", "config": runtime_config}


@app.post("/api/scan/upload")
@app.post("/api/verify/upload")
async def scan_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    required_items: Optional[str] = Form(None),
):
    """
    Process an uploaded image file (JPEG/PNG) from file picker or camera.
    Inference runs in a thread pool; snapshot save + DB log run as background tasks.
    """
    content = await file.read()
    req_list = json.loads(required_items) if required_items else runtime_config["required_items"]

    loop = asyncio.get_running_loop()
    analysis = await loop.run_in_executor(
        _executor, lambda: detector.analyze_image(content, req_list, runtime_config["thresholds"])
    )

    # Trigger hardware actuation asynchronously in background for immediate HTTP response
    if analysis["is_compliant"]:
        background_tasks.add_task(hardware.grant_access, worker_name="", cause="WELCOME")
    else:
        cause = "NO: " + ", ".join(analysis["missing_items"]).upper() if analysis.get("missing_items") else "PPE INCOMPLETE"
        background_tasks.add_task(hardware.deny_access, analysis["missing_items"], cause=cause)

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
    Process a base64 encoded snapshot from the live webcam feed.
    Inference runs in a thread pool; snapshot save + DB log run as background tasks.
    """
    header, b64data = req.image_base64.split(",", 1) if "," in req.image_base64 else ("", req.image_base64)
    image_bytes = base64.b64decode(b64data)
    req_list = req.required_items if req.required_items is not None else runtime_config["required_items"]

    loop = asyncio.get_running_loop()
    analysis = await loop.run_in_executor(
        _executor, lambda: detector.analyze_image(image_bytes, req_list, runtime_config["thresholds"])
    )

    if analysis["is_compliant"]:
        background_tasks.add_task(hardware.grant_access, worker_name="", cause="WELCOME")
    else:
        cause = "NO: " + ", ".join(analysis["missing_items"]).upper() if analysis.get("missing_items") else "PPE INCOMPLETE"
        background_tasks.add_task(hardware.deny_access, analysis["missing_items"], cause=cause)

    snapshot_filename = f"scan_{int(time.time()*1000)}.jpg"
    background_tasks.add_task(_save_snapshot_and_log, image_bytes, analysis, snapshot_filename)

    return {
        **analysis,
        "log_id": None,
        "hardware_state": hardware.get_state(),
    }


def _save_snapshot_and_log(image_bytes: bytes, analysis: Dict[str, Any], snapshot_filename: str):
    """Background task: persist snapshot file and write audit log entry."""
    snapshot_path = CAPTURES_DIR / snapshot_filename
    try:
        with open(snapshot_path, "wb") as f:
            f.write(image_bytes)
    except Exception:
        snapshot_filename = ""

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

    if analysis["is_compliant"]:
        background_tasks.add_task(hardware.grant_access, worker_name="ALEX", cause="WELCOME")
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


# Staff Management Endpoints
@app.get("/api/staff")
def get_staff_members():
    return event_logger.get_all_staff()


@app.post("/api/staff")
def create_staff_member(req: StaffCreateRequest):
    return event_logger.add_staff(
        name=req.name,
        employee_id=req.employee_id,
        department=req.department,
        role=req.role,
        required_ppe=req.required_ppe or ["helmet", "vest"],
    )


@app.delete("/api/staff/{staff_id}")
def remove_staff_member(staff_id: int):
    event_logger.delete_staff(staff_id)
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


# Serve Captured Images & Frontend Static Files
FRONTEND_DIR = BASE_DIR / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
app.mount("/data/captures", StaticFiles(directory=str(CAPTURES_DIR)), name="captures")

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

