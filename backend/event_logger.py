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
    SQLite audit trail & biometric staff directory database for all verification scans.
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
                    image_filename TEXT,
                    worker_name TEXT DEFAULT '',
                    employee_id TEXT DEFAULT '',
                    face_status TEXT DEFAULT '',
                    face_confidence REAL DEFAULT 0.0
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
                    avatar_bg TEXT DEFAULT '#f97316',
                    face_registered INTEGER DEFAULT 0,
                    face_embeddings TEXT DEFAULT '[]',
                    face_image TEXT DEFAULT '',
                    face_updated_at TEXT DEFAULT ''
                )
                """
            )

            # Non-destructive schema migrations for existing SQLite databases
            cursor.execute("PRAGMA table_info(staff)")
            staff_cols = {row[1] for row in cursor.fetchall()}
            if "face_registered" not in staff_cols:
                cursor.execute("ALTER TABLE staff ADD COLUMN face_registered INTEGER DEFAULT 0")
            if "face_embeddings" not in staff_cols:
                cursor.execute("ALTER TABLE staff ADD COLUMN face_embeddings TEXT DEFAULT '[]'")
            if "face_image" not in staff_cols:
                cursor.execute("ALTER TABLE staff ADD COLUMN face_image TEXT DEFAULT ''")
            if "face_updated_at" not in staff_cols:
                cursor.execute("ALTER TABLE staff ADD COLUMN face_updated_at TEXT DEFAULT ''")

            cursor.execute("PRAGMA table_info(access_logs)")
            log_cols = {row[1] for row in cursor.fetchall()}
            if "worker_name" not in log_cols:
                cursor.execute("ALTER TABLE access_logs ADD COLUMN worker_name TEXT DEFAULT ''")
            if "employee_id" not in log_cols:
                cursor.execute("ALTER TABLE access_logs ADD COLUMN employee_id TEXT DEFAULT ''")
            if "face_status" not in log_cols:
                cursor.execute("ALTER TABLE access_logs ADD COLUMN face_status TEXT DEFAULT ''")
            if "face_confidence" not in log_cols:
                cursor.execute("ALTER TABLE access_logs ADD COLUMN face_confidence REAL DEFAULT 0.0")

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
        worker_name: str = "",
        employee_id: str = "",
        face_status: str = "",
        face_confidence: float = 0.0,
    ) -> int:
        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO access_logs (
                    timestamp, status, compliance_percentage, average_confidence,
                    inference_time_ms, compliant_items, missing_items, detections,
                    image_filename, worker_name, employee_id, face_status, face_confidence
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    worker_name or "",
                    employee_id or "",
                    face_status or "",
                    round(float(face_confidence or 0.0), 1),
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
                    "average_confidence": round(avg_confidence, 3),
                    "inference_time_ms": round(inference_time_ms, 1),
                    "compliant_items": compliant_items,
                    "missing_items": missing_items,
                    "image_filename": image_filename or "",
                    "worker_name": worker_name or "",
                    "employee_id": employee_id or "",
                    "face_status": face_status or "",
                    "face_confidence": round(float(face_confidence or 0.0), 1),
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
                       inference_time_ms, compliant_items, missing_items, image_filename,
                       worker_name, employee_id, face_status, face_confidence
                FROM access_logs
                ORDER BY id DESC LIMIT ?
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            logs = []
            for r in rows:
                avg_conf_raw = float(r["average_confidence"] or 0.0)
                avg_conf_pct = round(avg_conf_raw * 100.0, 1) if avg_conf_raw <= 1.0 else round(avg_conf_raw, 1)
                logs.append({
                    "id": r["id"],
                    "timestamp": r["timestamp"],
                    "status": r["status"],
                    "compliance_percentage": r["compliance_percentage"],
                    "compliance_pct": r["compliance_percentage"],
                    "average_confidence": r["average_confidence"],
                    "avg_confidence": avg_conf_pct,
                    "inference_time_ms": r["inference_time_ms"],
                    "compliant_items": json.loads(r["compliant_items"]),
                    "missing_items": json.loads(r["missing_items"]),
                    "image_filename": r["image_filename"],
                    "worker_name": r["worker_name"] or "",
                    "employee_id": r["employee_id"] or "",
                    "face_status": r["face_status"] or "",
                    "face_confidence": r["face_confidence"] or 0.0,
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

            cursor.execute("SELECT COUNT(*) FROM access_logs WHERE face_status = 'UNAUTHORIZED'")
            unauth = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM staff WHERE face_registered = 1")
            enrolled_faces = cursor.fetchone()[0]

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

            pass_rate = round((granted / total * 100) if total > 0 else 100.0, 1)

            return {
                "total_scans": total,
                "granted_scans": granted,
                "denied_scans": denied,
                "granted": granted,
                "denied": denied,
                "pass_rate_percentage": pass_rate,
                "compliance_rate": pass_rate,
                "unauthorized_attempts": unauth,
                "enrolled_faces_count": enrolled_faces,
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

    # --- STAFF & BIOMETRIC FACE MANAGEMENT ---
    def _format_staff_row(self, r: sqlite3.Row) -> Dict[str, Any]:
        raw_embs = r["face_embeddings"] if "face_embeddings" in r.keys() else "[]"
        try:
            embs = json.loads(raw_embs) if raw_embs else []
        except Exception:
            embs = []
        face_reg = bool(r["face_registered"]) and len(embs) > 0
        return {
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
            "face_registered": face_reg,
            "face_samples_count": len(embs),
            "face_image": r["face_image"] or "",
            "face_updated_at": r["face_updated_at"] or "",
        }

    def get_all_staff(self) -> List[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM staff ORDER BY id ASC")
            rows = cursor.fetchall()
            return [self._format_staff_row(r) for r in rows]

    def get_staff_by_id(self, staff_id: int) -> Optional[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM staff WHERE id = ?", (staff_id,))
            row = cursor.fetchone()
            return self._format_staff_row(row) if row else None

    def get_enrolled_staff_embeddings(self) -> List[Dict[str, Any]]:
        """Returns all workers with enrolled biometric face vectors for gate matching."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM staff WHERE face_registered = 1")
            rows = cursor.fetchall()
            enrolled = []
            for r in rows:
                try:
                    embs = json.loads(r["face_embeddings"]) if r["face_embeddings"] else []
                except Exception:
                    embs = []
                if not embs:
                    continue
                enrolled.append({
                    "id": r["id"],
                    "name": r["name"],
                    "employee_id": r["employee_id"],
                    "department": r["department"],
                    "role": r["role"],
                    "required_ppe": json.loads(r["required_ppe"]) if r["required_ppe"] else ["helmet", "vest"],
                    "status": r["status"],
                    "face_embeddings": embs,
                    "face_image": r["face_image"] or "",
                })
            return enrolled

    def add_staff(
        self,
        name: str,
        employee_id: str,
        department: str,
        role: str,
        required_ppe: List[str],
        face_embeddings: Optional[List[List[float]]] = None,
        face_image: str = "",
    ) -> Dict[str, Any]:
        palette = ["#f97316", "#ea580c", "#2563eb", "#16a34a", "#9333ea", "#0891b2"]
        color = palette[abs(hash(employee_id)) % len(palette)]
        has_face = 1 if (face_embeddings and len(face_embeddings) > 0) else 0
        embs_json = json.dumps(face_embeddings or [])
        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M") if has_face else ""

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM staff WHERE LOWER(employee_id) = LOWER(?)", (employee_id.strip(),))
            if cursor.fetchone():
                raise ValueError(f"Employee ID '{employee_id}' is already registered in the directory.")

            cursor.execute(
                """
                INSERT INTO staff (
                    name, employee_id, department, role, required_ppe,
                    status, compliance_score, last_access, avatar_bg,
                    face_registered, face_embeddings, face_image, face_updated_at
                )
                VALUES (?, ?, ?, ?, ?, 'ACTIVE', 100.0, 'Just Added', ?, ?, ?, ?, ?)
                """,
                (
                    name.strip(),
                    employee_id.strip(),
                    department,
                    role,
                    json.dumps(required_ppe),
                    color,
                    has_face,
                    embs_json,
                    face_image or "",
                    now_iso,
                ),
            )
            conn.commit()
            new_id = cursor.lastrowid

        data = {
            "id": new_id,
            "name": name.strip(),
            "employee_id": employee_id.strip(),
            "department": department,
            "role": role,
            "required_ppe": required_ppe,
            "status": "ACTIVE",
            "compliance_score": 100.0,
            "last_access": "Just Added",
            "avatar_bg": color,
            "face_registered": bool(has_face),
            "face_samples_count": len(face_embeddings or []),
            "face_image": face_image or "",
            "face_updated_at": now_iso,
        }
        try:
            from firebase_sync import sync_staff_member
            sync_staff_member(f"staff_{new_id}", {**data, "id": f"staff_{new_id}"})
        except Exception:
            pass
        return data

    def enroll_staff_face(
        self,
        staff_id: int,
        embeddings: List[List[float]],
        face_image: str,
        replace: bool = False,
    ) -> Dict[str, Any]:
        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M")
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM staff WHERE id = ?", (staff_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError("Worker record not found in directory.")

            existing_embs: List[List[float]] = []
            if not replace and row["face_embeddings"]:
                try:
                    existing_embs = json.loads(row["face_embeddings"]) or []
                except Exception:
                    existing_embs = []

            combined = (existing_embs + embeddings)[-6:]  # Keep up to 6 multi-angle biometric vectors
            cursor.execute(
                """
                UPDATE staff
                SET face_registered = 1,
                    face_embeddings = ?,
                    face_image = ?,
                    face_updated_at = ?
                WHERE id = ?
                """,
                (json.dumps(combined), face_image, now_iso, staff_id),
            )
            conn.commit()

            cursor.execute("SELECT * FROM staff WHERE id = ?", (staff_id,))
            updated_row = cursor.fetchone()
            formatted = self._format_staff_row(updated_row)

        try:
            from firebase_sync import sync_staff_member
            sync_staff_member(f"staff_{staff_id}", {**formatted, "id": f"staff_{staff_id}"})
        except Exception:
            pass

        return formatted

    def clear_staff_face(self, staff_id: int) -> Dict[str, Any]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM staff WHERE id = ?", (staff_id,))
            if not cursor.fetchone():
                raise ValueError("Worker record not found.")
            cursor.execute(
                """
                UPDATE staff
                SET face_registered = 0,
                    face_embeddings = '[]',
                    face_image = '',
                    face_updated_at = ''
                WHERE id = ?
                """,
                (staff_id,),
            )
            conn.commit()
            cursor.execute("SELECT * FROM staff WHERE id = ?", (staff_id,))
            return self._format_staff_row(cursor.fetchone())

    def update_staff_access(self, staff_id: int):
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE staff SET last_access = ? WHERE id = ?", (now_str, staff_id))
            conn.commit()

    def toggle_staff_status(self, staff_id: int) -> Dict[str, Any]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM staff WHERE id = ?", (staff_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError("Staff member not found")
            new_status = "RESTRICTED" if row["status"] == "ACTIVE" else "ACTIVE"
            cursor.execute("UPDATE staff SET status = ? WHERE id = ?", (new_status, staff_id))
            conn.commit()
            cursor.execute("SELECT * FROM staff WHERE id = ?", (staff_id,))
            formatted = self._format_staff_row(cursor.fetchone())
            try:
                from firebase_sync import sync_staff_member
                sync_staff_member(f"staff_{staff_id}", {**formatted, "id": f"staff_{staff_id}"})
            except Exception:
                pass
            return {"id": staff_id, "status": new_status}

    def update_staff(
        self,
        staff_id: int,
        name: Optional[str] = None,
        employee_id: Optional[str] = None,
        department: Optional[str] = None,
        role: Optional[str] = None,
        required_ppe: Optional[List[str]] = None,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM staff WHERE id = ?", (staff_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError("Worker record not found in directory.")

            if employee_id and employee_id.strip().lower() != row["employee_id"].lower():
                cursor.execute(
                    "SELECT id FROM staff WHERE LOWER(employee_id) = LOWER(?) AND id != ?",
                    (employee_id.strip(), staff_id),
                )
                if cursor.fetchone():
                    raise ValueError(f"Employee ID '{employee_id}' is already registered to another worker.")

            new_name = name.strip() if name is not None else row["name"]
            new_emp_id = employee_id.strip() if employee_id is not None else row["employee_id"]
            new_dept = department.strip() if department is not None else row["department"]
            new_role = role.strip() if role is not None else row["role"]
            new_ppe = json.dumps(required_ppe) if required_ppe is not None else row["required_ppe"]
            new_status = status.strip() if status is not None else row["status"]

            cursor.execute(
                """
                UPDATE staff
                SET name = ?, employee_id = ?, department = ?, role = ?, required_ppe = ?, status = ?
                WHERE id = ?
                """,
                (new_name, new_emp_id, new_dept, new_role, new_ppe, new_status, staff_id),
            )
            conn.commit()

            cursor.execute("SELECT * FROM staff WHERE id = ?", (staff_id,))
            formatted = self._format_staff_row(cursor.fetchone())

        try:
            from firebase_sync import sync_staff_member
            sync_staff_member(f"staff_{staff_id}", {**formatted, "id": f"staff_{staff_id}"})
        except Exception:
            pass

        return formatted

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
        lines = [
            "Log ID,Timestamp,Worker Name,Employee ID,Face Auth,Status,Compliance Pct,Avg Confidence,Latency (ms),Compliant Items,Missing Items"
        ]
        for log in logs:
            c_items = "; ".join(log["compliant_items"])
            m_items = "; ".join(log["missing_items"])
            w_name = log.get("worker_name") or "Unidentified"
            emp_id = log.get("employee_id") or "-"
            f_stat = log.get("face_status") or "-"
            lines.append(
                f'{log["id"]},"{log["timestamp"]}","{w_name}","{emp_id}","{f_stat}","{log["status"]}",{log["compliance_percentage"]}%,{log["avg_confidence"]}%,{log["inference_time_ms"]}ms,"{c_items}","{m_items}"'
            )
        return "\n".join(lines)


# Singleton
event_logger = EventLogger()
