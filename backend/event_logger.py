import sqlite3
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from config import DATA_DIR

DB_PATH = DATA_DIR / "ppe_access_logs.db"


class EventLogger:
    """
    SQLite audit trail database for all verification scans.
    """
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = str(db_path)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS access_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    status TEXT NOT NULL,
                    compliance_percentage REAL NOT NULL,
                    average_confidence REAL NOT NULL,
                    inference_time_ms REAL NOT NULL,
                    compliant_items TEXT NOT NULL,
                    missing_items TEXT NOT NULL,
                    detections TEXT NOT NULL,
                    image_filename TEXT
                )
                """
            )

            # Staff Table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS staff (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    employee_id TEXT UNIQUE NOT NULL,
                    department TEXT NOT NULL,
                    role TEXT NOT NULL,
                    required_ppe TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'ACTIVE',
                    compliance_score REAL DEFAULT 99.0,
                    last_access TEXT,
                    avatar_bg TEXT DEFAULT '#f97316'
                )
                """
            )

            # System Settings Table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS system_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )

            # Contact & Demo Inquiries Table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS contact_inquiries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    company TEXT,
                    site_type TEXT,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )

            # Seed default staff if table is empty
            cursor.execute("SELECT COUNT(*) FROM staff")
            if cursor.fetchone()[0] == 0:
                initial_staff = [
                    ("Alex Vance", "EMP-1042", "Construction Operations", "Site Engineer", json.dumps(["helmet", "vest"]), "ACTIVE", 99.4, "2026-10-07 11:42", "#f97316"),
                    ("Marcus Miller", "EMP-2089", "Heavy Machinery", "Crane Operator", json.dumps(["helmet", "vest"]), "ACTIVE", 98.7, "2026-10-07 10:15", "#ea580c"),
                    ("Dr. Elena Rostova", "EMP-3011", "Quality & Safety", "Lead Safety Inspector", json.dumps(["helmet", "vest", "mask"]), "ACTIVE", 100.0, "2026-10-07 12:05", "#16a34a"),
                    ("David Chen", "EMP-4105", "Electrical High Voltage", "Substation Tech", json.dumps(["helmet", "vest", "gloves"]), "ACTIVE", 97.2, "2026-10-06 16:30", "#2563eb"),
                    ("Sarah Connor", "EMP-5024", "Hazardous Chemical", "Safety Officer", json.dumps(["helmet", "vest", "mask"]), "ACTIVE", 100.0, "2026-10-07 09:12", "#9333ea"),
                    ("Vikram Patel", "CON-8821", "Logistics & Supply", "Site Contractor", json.dumps(["helmet", "vest"]), "RESTRICTED", 84.5, "2026-10-05 14:20", "#dc2626"),
                ]
                cursor.executemany(
                    """
                    INSERT INTO staff (name, employee_id, department, role, required_ppe, status, compliance_score, last_access, avatar_bg)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    initial_staff,
                )

            # Seed initial settings if empty
            cursor.execute("SELECT COUNT(*) FROM system_settings")
            if cursor.fetchone()[0] == 0:
                default_settings = {
                    "strict_mode": "true",
                    "gate_open_duration": "5",
                    "confidence_threshold": "0.50",
                    "sound_alerts": "true",
                    "buzzer_volume": "80",
                    "camera_res": "1280x720",
                    "site_name": "Sector 4 Industrial Terminal",
                }
                for k, v in default_settings.items():
                    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)", (k, v))

            conn.commit()

    def log_scan(
        self,
        status: str,
        compliance_pct: float,
        avg_confidence: float,
        inference_time_ms: float,
        compliant_items: List[str],
        missing_items: List[str],
        detections: Dict[str, Any],
        image_filename: Optional[str] = None,
    ) -> int:
        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO access_logs (
                    timestamp, status, compliance_percentage, average_confidence,
                    inference_time_ms, compliant_items, missing_items, detections, image_filename
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    now_iso,
                    status,
                    compliance_pct,
                    avg_confidence,
                    inference_time_ms,
                    json.dumps(compliant_items),
                    json.dumps(missing_items),
                    json.dumps(detections),
                    image_filename or "",
                ),
            )
            conn.commit()
            new_id = cursor.lastrowid

            try:
                from firebase_sync import sync_log
                sync_log({
                    "id": new_id,
                    "timestamp": now_iso,
                    "status": status,
                    "compliance_percentage": round(compliance_pct, 1),
                    "average_confidence": round(avg_confidence, 1),
                    "inference_time_ms": round(inference_time_ms, 1),
                    "compliant_items": compliant_items,
                    "missing_items": missing_items,
                    "image_filename": image_filename or "",
                })
            except Exception:
                pass

            return new_id

    def get_recent_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, timestamp, status, compliance_percentage, average_confidence,
                       inference_time_ms, compliant_items, missing_items, image_filename
                FROM access_logs
                ORDER BY id DESC LIMIT ?
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            logs = []
            for r in rows:
                logs.append({
                    "id": r["id"],
                    "timestamp": r["timestamp"],
                    "status": r["status"],
                    "compliance_percentage": r["compliance_percentage"],
                    "average_confidence": r["average_confidence"],
                    "inference_time_ms": r["inference_time_ms"],
                    "compliant_items": json.loads(r["compliant_items"]),
                    "missing_items": json.loads(r["missing_items"]),
                    "image_filename": r["image_filename"],
                })
            return logs

    def get_statistics(self) -> Dict[str, Any]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM access_logs")
            total = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM access_logs WHERE status = 'GRANTED'")
            granted = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM access_logs WHERE status = 'DENIED'")
            denied = cursor.fetchone()[0]

            cursor.execute("SELECT AVG(inference_time_ms) FROM access_logs")
            avg_time = cursor.fetchone()[0] or 0.0

            # Missing items frequency breakdown
            cursor.execute("SELECT missing_items FROM access_logs WHERE status = 'DENIED'")
            denied_rows = cursor.fetchall()
            violations = {"helmet": 0, "vest": 0, "mask": 0, "gloves": 0, "shoes": 0}
            for row in denied_rows:
                items = json.loads(row[0])
                for itm in items:
                    if itm in violations:
                        violations[itm] += 1

            pass_rate = round((granted / total * 100) if total > 0 else 0.0, 1)

            return {
                "total_scans": total,
                "granted_scans": granted,
                "denied_scans": denied,
                "pass_rate_percentage": pass_rate,
                "avg_inference_time_ms": round(avg_time, 1),
                "violations_by_item": violations,
            }

    def clear_logs(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM access_logs")
            conn.commit()
        try:
            from firebase_sync import clear_logs as fb_clear_logs
            fb_clear_logs()
        except Exception:
            pass

    # --- STAFF MANAGEMENT ---
    def get_all_staff(self) -> List[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM staff ORDER BY id ASC")
            rows = cursor.fetchall()
            staff_list = []
            for r in rows:
                staff_list.append({
                    "id": r["id"],
                    "name": r["name"],
                    "employee_id": r["employee_id"],
                    "department": r["department"],
                    "role": r["role"],
                    "required_ppe": json.loads(r["required_ppe"]) if r["required_ppe"] else ["helmet", "vest"],
                    "status": r["status"],
                    "compliance_score": r["compliance_score"],
                    "last_access": r["last_access"],
                    "avatar_bg": r["avatar_bg"],
                })
            return staff_list

    def add_staff(self, name: str, employee_id: str, department: str, role: str, required_ppe: List[str]) -> Dict[str, Any]:
        palette = ["#f97316", "#ea580c", "#2563eb", "#16a34a", "#9333ea", "#0891b2"]
        color = palette[abs(hash(employee_id)) % len(palette)]
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO staff (name, employee_id, department, role, required_ppe, status, compliance_score, last_access, avatar_bg)
                VALUES (?, ?, ?, ?, ?, 'ACTIVE', 100.0, 'Just Added', ?)
                """,
                (name, employee_id, department, role, json.dumps(required_ppe), color),
            )
            conn.commit()
            new_id = cursor.lastrowid
            data = {
                "id": f"staff_{new_id}",
                "name": name,
                "employee_id": employee_id,
                "department": department,
                "role": role,
                "required_ppe": required_ppe,
                "status": "ACTIVE",
                "compliance_score": 100.0,
                "last_access": "Just Added",
                "avatar_bg": color,
            }
            try:
                from firebase_sync import sync_staff_member
                sync_staff_member(f"staff_{new_id}", data)
            except Exception:
                pass
            return {**data, "id": new_id}

    def toggle_staff_status(self, staff_id: int) -> Dict[str, Any]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT status, name, employee_id, department, role, required_ppe, avatar_bg FROM staff WHERE id = ?", (staff_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError("Staff member not found")
            new_status = "RESTRICTED" if row[0] == "ACTIVE" else "ACTIVE"
            cursor.execute("UPDATE staff SET status = ? WHERE id = ?", (new_status, staff_id))
            conn.commit()
            try:
                from firebase_sync import sync_staff_member
                sync_staff_member(f"staff_{staff_id}", {
                    "id": f"staff_{staff_id}",
                    "name": row[1],
                    "employee_id": row[2],
                    "department": row[3],
                    "role": row[4],
                    "required_ppe": json.loads(row[5]) if row[5] else ["helmet", "vest"],
                    "status": new_status,
                    "avatar_bg": row[6],
                })
            except Exception:
                pass
            return {"id": staff_id, "status": new_status}

    def delete_staff(self, staff_id: int):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM staff WHERE id = ?", (staff_id,))
            conn.commit()
        try:
            from firebase_sync import delete_staff_member
            delete_staff_member(f"staff_{staff_id}")
        except Exception:
            pass

    # --- SYSTEM SETTINGS ---
    def get_settings(self) -> Dict[str, str]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM system_settings")
            rows = cursor.fetchall()
            return {r[0]: r[1] for r in rows}

    def save_settings(self, settings_dict: Dict[str, Any]):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            for k, v in settings_dict.items():
                cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)", (str(k), str(v)))
            conn.commit()
        try:
            from firebase_sync import sync_system_settings
            sync_system_settings(settings_dict)
        except Exception:
            pass

    # --- CONTACT INQUIRIES ---
    def save_contact(self, name: str, email: str, company: str, site_type: str, message: str) -> int:
        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO contact_inquiries (name, email, company, site_type, message, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (name, email, company, site_type, message, now_iso),
            )
            conn.commit()
            inquiry_id = cursor.lastrowid
        try:
            from firebase_sync import _firebase_request, FIREBASE_DATABASE_URL
            _firebase_request(f"{FIREBASE_DATABASE_URL}/inquiries/inq_{inquiry_id}.json", method="PUT", data={
                "id": inquiry_id,
                "name": name,
                "email": email,
                "company": company,
                "site_type": site_type,
                "message": message,
                "created_at": now_iso,
            })
        except Exception:
            pass
        return inquiry_id

    # --- CSV EXPORT ---
    def export_csv(self) -> str:
        logs = self.get_recent_logs(limit=500)
        lines = ["Log ID,Timestamp,Status,Compliance Pct,Avg Confidence,Latency (ms),Compliant Items,Missing Items"]
        for log in logs:
            c_items = "; ".join(log["compliant_items"])
            m_items = "; ".join(log["missing_items"])
            lines.append(
                f'{log["id"]},"{log["timestamp"]}","{log["status"]}",{log["compliance_percentage"]}%,{log["average_confidence"]}%,{log["inference_time_ms"]}ms,"{c_items}","{m_items}"'
            )
        return "\n".join(lines)


# Singleton
event_logger = EventLogger()
