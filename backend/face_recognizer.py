import io
import base64
import threading
import urllib.request
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union

import cv2
import numpy as np
from PIL import Image, ImageOps

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pass

from config import FACE_MODEL_PATH, SFACE_MODEL_PATH, DEFAULT_FACE_MATCH_THRESHOLD

SFACE_FALLBACK_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_recognition_sface/face_recognition_sface_2021dec.onnx"
)


class FaceRecognizer:
    """
    Biometric Worker Face Detection & Recognition Engine.
    Uses OpenCV YuNet (5-landmark deep face detector) + SFace (128-D deep CNN
    facial feature extractor) to enroll worker faces and simultaneously verify
    worker authorization during PPE gate scans without altering PPE detection.
    """

    def __init__(
        self,
        yunet_path: Optional[str] = None,
        sface_path: Optional[str] = None,
    ):
        self.yunet_path = str(yunet_path) if yunet_path else str(FACE_MODEL_PATH)
        self.sface_path = str(sface_path) if sface_path else str(SFACE_MODEL_PATH)
        self.detector = None
        self.recognizer = None
        self._lock = threading.Lock()
        self._init_models()

    def _resolve_model(self, primary: str, filename: str) -> Optional[str]:
        candidates = [
            Path(primary),
            Path(__file__).resolve().parent / "models" / filename,
            Path(__file__).resolve().parent.parent / "models" / filename,
        ]
        for p in candidates:
            if p.exists() and p.stat().st_size > 10_000:
                return str(p)
        return None

    def _init_models(self):
        face_det_file = self._resolve_model(self.yunet_path, "face_detection_yunet.onnx")
        if face_det_file:
            try:
                self.detector = cv2.FaceDetectorYN.create(
                    face_det_file,
                    "",
                    (320, 320),
                    0.50,
                    0.30,
                    5000,
                )
                print(f"[Face Recognition Engine] Loaded YuNet detector: {face_det_file}")
            except Exception as e:
                print(f"[Face Recognition Engine] YuNet init warning: {e}")

        sface_file = self._resolve_model(self.sface_path, "face_recognition_sface.onnx")
        if not sface_file:
            # Attempt automatic download on cloud/fresh environments if network is available
            target = Path(self.sface_path)
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                print("[Face Recognition Engine] Downloading SFace model from OpenCV Zoo...")
                urllib.request.urlretrieve(SFACE_FALLBACK_URL, str(target))
                if target.exists() and target.stat().st_size > 1_000_000:
                    sface_file = str(target)
            except Exception as e:
                print(f"[Face Recognition Engine] SFace auto-download skipped: {e}")

        if sface_file:
            try:
                self.recognizer = cv2.FaceRecognizerSF.create(sface_file, "")
                print(f"[Face Recognition Engine] Loaded SFace 128-D recognizer: {sface_file}")
            except Exception as e:
                print(f"[Face Recognition Engine] SFace init warning: {e}")

    @staticmethod
    def decode_image(image_input: Union[bytes, str, np.ndarray]) -> np.ndarray:
        """Decode bytes, base64 data URL, or BGR ndarray into a BGR numpy image."""
        if isinstance(image_input, np.ndarray):
            return image_input.copy()

        if isinstance(image_input, str):
            raw_b64 = image_input.split(",", 1)[1] if "," in image_input else image_input
            image_bytes = base64.b64decode(raw_b64)
        elif isinstance(image_input, (bytes, bytearray)):
            image_bytes = bytes(image_input)
        else:
            raise TypeError("Unsupported image input type for face recognition")

        try:
            pil_img = Image.open(io.BytesIO(image_bytes))
            pil_img = ImageOps.exif_transpose(pil_img).convert("RGB")
            rgb_np = np.array(pil_img)
            return cv2.cvtColor(rgb_np, cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise ValueError(f"Could not decode image for face recognition: {e}")

    @staticmethod
    def _enhance_illumination(img_bgr: np.ndarray) -> np.ndarray:
        """CLAHE luminance normalization to detect faces under helmet shadow or dim lighting."""
        ycrcb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YCrCb)
        y, cr, cb = cv2.split(ycrcb)
        clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
        y_eq = clahe.apply(y)
        return cv2.cvtColor(cv2.merge((y_eq, cr, cb)), cv2.COLOR_YCrCb2BGR)

    def _detect_primary_face(self, img_bgr: np.ndarray) -> Optional[np.ndarray]:
        """
        Detects the primary foreground worker face and returns the 15-float YuNet
        vector scaled to img_bgr's native coordinates.
        """
        if self.detector is None:
            return None

        orig_h, orig_w = img_bgr.shape[:2]
        MAX_SIDE = 960
        scale = 1.0
        if max(orig_w, orig_h) > MAX_SIDE:
            scale = MAX_SIDE / float(max(orig_w, orig_h))
            det_w = max(64, int(orig_w * scale))
            det_h = max(64, int(orig_h * scale))
            det_img = cv2.resize(img_bgr, (det_w, det_h), interpolation=cv2.INTER_AREA)
        else:
            det_w, det_h = orig_w, orig_h
            det_img = img_bgr

        faces = None
        with self._lock:
            self.detector.setScoreThreshold(0.50)
            self.detector.setInputSize((det_w, det_h))
            _, faces = self.detector.detect(det_img)

            # Fallback pass with CLAHE luminance enhancement for backlit / hard-hat brim shadow
            if faces is None or len(faces) == 0:
                enhanced = self._enhance_illumination(det_img)
                self.detector.setScoreThreshold(0.42)
                self.detector.setInputSize((det_w, det_h))
                _, faces = self.detector.detect(enhanced)
                self.detector.setScoreThreshold(0.50)

        if faces is None or len(faces) == 0:
            return None

        inv_scale = 1.0 / scale if scale > 0 else 1.0
        valid_faces: List[Tuple[float, np.ndarray]] = []
        for f in faces:
            f_scaled = f.astype(np.float32).copy()
            f_scaled[:14] *= inv_scale
            fw, fh = float(f_scaled[2]), float(f_scaled[3])
            conf = float(f_scaled[14])
            if fw < 16 or fh < 16:
                continue
            prominence = (fw * fh) * max(0.5, conf)
            valid_faces.append((prominence, f_scaled))

        if not valid_faces:
            return None

        valid_faces.sort(key=lambda item: item[0], reverse=True)
        return valid_faces[0][1]

    @staticmethod
    def _l2_normalize(vec: np.ndarray) -> np.ndarray:
        flat = vec.flatten().astype(np.float32)
        norm = float(np.linalg.norm(flat))
        if norm > 1e-8:
            flat = flat / norm
        return flat

    def _extract_embedding_pair(self, img_bgr: np.ndarray, face_row: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Extracts L2-normalized 128-D SFace embedding AND its horizontal-mirror counterpart
        so mirrored front webcams and unmirrored rear/uploaded photos match identically.
        """
        if self.recognizer is not None:
            with self._lock:
                aligned = self.recognizer.alignCrop(img_bgr, face_row)
                feat = self.recognizer.feature(aligned)
                feat_flip = self.recognizer.feature(cv2.flip(aligned, 1))
            return self._l2_normalize(feat), self._l2_normalize(feat_flip)

        # Deterministic fallback descriptor if SFace model is unavailable
        x, y, w, h = [max(0, int(v)) for v in face_row[:4]]
        crop = img_bgr[y:min(img_bgr.shape[0], y + h), x:min(img_bgr.shape[1], x + w)]
        if crop.size == 0:
            z = np.zeros(128, dtype=np.float32)
            return z, z
        gray = cv2.resize(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), (16, 8))
        gray_flip = cv2.flip(gray, 1)
        return self._l2_normalize(gray), self._l2_normalize(gray_flip)

    @staticmethod
    def _crop_portrait_thumbnail(
        img_bgr: np.ndarray, bbox: List[int], size: int = 160
    ) -> Tuple[str, bytes]:
        """Creates a clean square portrait thumbnail around the worker's face."""
        h, w = img_bgr.shape[:2]
        x1, y1, x2, y2 = bbox
        fw = max(1, x2 - x1)
        fh = max(1, y2 - y1)
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        half_side = int(max(fw, fh) * 0.85)

        sx1 = max(0, cx - half_side)
        sy1 = max(0, cy - int(half_side * 1.05))
        sx2 = min(w, cx + half_side)
        sy2 = min(h, cy + int(half_side * 0.95))

        crop = img_bgr[sy1:sy2, sx1:sx2]
        if crop.size == 0:
            crop = img_bgr
        thumb = cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA)
        _, buf = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 86])
        jpg_bytes = buf.tobytes()
        b64 = base64.b64encode(jpg_bytes).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}", jpg_bytes

    def validate_and_extract(self, image_input: Union[bytes, str, np.ndarray]) -> Dict[str, Any]:
        """
        Validates a single enrollment image, ensures a clear face is visible,
        and returns its 128-D biometric embedding + portrait thumbnail.
        """
        img_bgr = self.decode_image(image_input)
        h, w = img_bgr.shape[:2]
        face_row = self._detect_primary_face(img_bgr)
        if face_row is None:
            raise ValueError(
                "No clear face detected. Please face the camera directly with good lighting and unobstructed eyes/nose."
            )

        fx, fy, fw, fh = [int(round(v)) for v in face_row[:4]]
        bbox = [max(0, fx), max(0, fy), min(w, fx + fw), min(h, fy + fh)]
        face_conf = round(min(0.99, float(face_row[14])), 3)

        feat, _ = self._extract_embedding_pair(img_bgr, face_row)
        avatar_data_url, avatar_bytes = self._crop_portrait_thumbnail(img_bgr, bbox)

        return {
            "embedding": [round(float(x), 6) for x in feat.tolist()],
            "avatar_data_url": avatar_data_url,
            "avatar_bytes": avatar_bytes,
            "bbox": bbox,
            "face_confidence": face_conf,
        }

    def extract_multi_enrollment(
        self, image_inputs: List[Union[bytes, str, np.ndarray]]
    ) -> Dict[str, Any]:
        """
        Processes 1 or multiple face images for enrollment, extracting biometric
        embeddings from all valid frames and picking the sharpest portrait thumbnail.
        """
        if not image_inputs:
            raise ValueError("At least one face image is required for enrollment.")

        embeddings: List[List[float]] = []
        best_sample: Optional[Dict[str, Any]] = None
        last_error = "No clear face detected."

        for img_in in image_inputs:
            try:
                sample = self.validate_and_extract(img_in)
                embeddings.append(sample["embedding"])
                if best_sample is None or sample["face_confidence"] > best_sample["face_confidence"]:
                    best_sample = sample
            except Exception as e:
                last_error = str(e)

        if not embeddings or best_sample is None:
            raise ValueError(last_error)

        return {
            "embeddings": embeddings,
            "samples_count": len(embeddings),
            "avatar_data_url": best_sample["avatar_data_url"],
            "avatar_bytes": best_sample["avatar_bytes"],
            "face_confidence": best_sample["face_confidence"],
            "bbox": best_sample["bbox"],
        }

    @staticmethod
    def _calibrate_confidence_pct(cosine_sim: float, threshold: float) -> float:
        """Maps raw SFace cosine similarity (threshold ~0.38) to intuitive % confidence."""
        if cosine_sim < threshold:
            return round(max(0.0, (cosine_sim / max(0.01, threshold)) * 65.0), 1)
        # 0.38 -> ~84%, 0.55 -> ~93%, 0.75+ -> ~99%
        pct = 84.0 + (cosine_sim - threshold) * 38.0
        return round(min(99.7, max(80.0, pct)), 1)

    def verify_face(
        self,
        image_input: Union[bytes, str, np.ndarray],
        enrolled_staff: List[Dict[str, Any]],
        threshold: float = DEFAULT_FACE_MATCH_THRESHOLD,
    ) -> Dict[str, Any]:
        """
        Simultaneously detects the worker's face during a gate scan and verifies
        whether they are an authorized registered worker or an unauthorized person.
        """
        img_bgr = self.decode_image(image_input)
        h, w = img_bgr.shape[:2]
        face_row = self._detect_primary_face(img_bgr)

        enrolled_count = len(enrolled_staff)

        if face_row is None:
            return {
                "face_detected": False,
                "face_status": "NO_FACE",
                "is_authorized": False,
                "worker": None,
                "similarity_score": 0.0,
                "match_confidence": 0.0,
                "face_confidence": 0.0,
                "bbox": [0, 0, 0, 0],
                "enrolled_workers_count": enrolled_count,
                "message": "Face not visible — please look directly at the gate camera",
            }

        fx, fy, fw, fh = [int(round(v)) for v in face_row[:4]]
        bbox = [max(0, fx), max(0, fy), min(w, fx + fw), min(h, fy + fh)]
        face_conf = round(min(0.99, float(face_row[14])), 3)

        feat, feat_flip = self._extract_embedding_pair(img_bgr, face_row)

        best_worker: Optional[Dict[str, Any]] = None
        best_score = -1.0

        for staff in enrolled_staff:
            stored_embs = staff.get("face_embeddings") or []
            if not stored_embs:
                continue

            worker_scores: List[float] = []
            for emb in stored_embs:
                if not emb or len(emb) != len(feat):
                    continue
                ref = self._l2_normalize(np.array(emb, dtype=np.float32))
                s1 = float(np.dot(feat, ref))
                s2 = float(np.dot(feat_flip, ref))
                worker_scores.append(max(s1, s2))

            if not worker_scores:
                continue

            top_sim = max(worker_scores)
            # Slight multi-sample consistency boost when multiple enrolled angles agree
            if len(worker_scores) > 1:
                avg_sim = sum(worker_scores) / len(worker_scores)
                if avg_sim >= threshold:
                    top_sim = min(1.0, top_sim + 0.015)

            if top_sim > best_score:
                best_score = top_sim
                best_worker = staff

        if best_worker is not None and best_score >= threshold:
            match_pct = self._calibrate_confidence_pct(best_score, threshold)
            worker_status = (best_worker.get("status") or "ACTIVE").upper()
            worker_info = {
                "id": best_worker["id"],
                "name": best_worker["name"],
                "employee_id": best_worker["employee_id"],
                "department": best_worker.get("department", "Operations"),
                "role": best_worker.get("role", "Site Worker"),
                "status": worker_status,
                "face_image": best_worker.get("face_image", ""),
            }

            if worker_status == "ACTIVE":
                return {
                    "face_detected": True,
                    "face_status": "AUTHORIZED",
                    "is_authorized": True,
                    "worker": worker_info,
                    "similarity_score": round(best_score, 4),
                    "match_confidence": match_pct,
                    "face_confidence": face_conf,
                    "bbox": bbox,
                    "enrolled_workers_count": enrolled_count,
                    "message": f"Authorized Worker: {worker_info['name']} ({worker_info['employee_id']})",
                }
            else:
                return {
                    "face_detected": True,
                    "face_status": "SUSPENDED",
                    "is_authorized": False,
                    "worker": worker_info,
                    "similarity_score": round(best_score, 4),
                    "match_confidence": match_pct,
                    "face_confidence": face_conf,
                    "bbox": bbox,
                    "enrolled_workers_count": enrolled_count,
                    "message": f"Permit Suspended: {worker_info['name']} ({worker_info['employee_id']})",
                }

        # Face detected, but does NOT match any enrolled authorized worker
        sim_val = max(0.0, best_score) if best_score > 0 else 0.0
        unauth_msg = (
            "Unauthorized Person — No workers have Face ID enrolled yet (enroll in Worker Directory)"
            if enrolled_count == 0
            else "Unauthorized Person — Face does not match any registered worker"
        )
        return {
            "face_detected": True,
            "face_status": "UNAUTHORIZED",
            "is_authorized": False,
            "worker": None,
            "similarity_score": round(sim_val, 4),
            "match_confidence": self._calibrate_confidence_pct(sim_val, threshold),
            "face_confidence": face_conf,
            "bbox": bbox,
            "enrolled_workers_count": enrolled_count,
            "message": unauth_msg,
        }

    @staticmethod
    def overlay_face_annotation(
        annotated_data_url: str,
        face_result: Dict[str, Any],
        final_is_compliant: bool,
        ppe_missing_items: List[str],
        require_face_auth: bool = True,
    ) -> str:
        """
        Draws the biometric face recognition box & worker identity badge onto the
        PPE-annotated image and updates the top status banner without touching PPEDetector.
        """
        if not annotated_data_url:
            return annotated_data_url

        try:
            raw_b64 = annotated_data_url.split(",", 1)[1] if "," in annotated_data_url else annotated_data_url
            img_bytes = base64.b64decode(raw_b64)
            np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
            canvas = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if canvas is None:
                return annotated_data_url

            h, w = canvas.shape[:2]
            face_status = face_result.get("face_status", "NO_FACE")
            worker = face_result.get("worker")

            # Draw biometric face frame if face was detected
            if face_result.get("face_detected") and face_result.get("bbox"):
                fx1, fy1, fx2, fy2 = face_result["bbox"]
                fx1, fy1 = max(0, fx1), max(0, fy1)
                fx2, fy2 = min(w - 1, fx2), min(h - 1, fy2)

                if fx2 > fx1 and fy2 > fy1:
                    is_auth = face_result.get("is_authorized", False)
                    # Teal-Emerald for Authorized Worker, Crimson Red for Unauthorized/Suspended
                    face_color = (110, 210, 25) if is_auth else (40, 40, 235)

                    cv2.rectangle(canvas, (fx1, fy1), (fx2, fy2), face_color, 2)
                    clen = min(18, max(4, (fx2 - fx1) // 4), max(4, (fy2 - fy1) // 4))
                    cv2.line(canvas, (fx1, fy1), (fx1 + clen, fy1), face_color, 3)
                    cv2.line(canvas, (fx1, fy1), (fx1, fy1 + clen), face_color, 3)
                    cv2.line(canvas, (fx2, fy1), (fx2 - clen, fy1), face_color, 3)
                    cv2.line(canvas, (fx2, fy1), (fx2, fy1 + clen), face_color, 3)
                    cv2.line(canvas, (fx1, fy2), (fx1 + clen, fy2), face_color, 3)
                    cv2.line(canvas, (fx1, fy2), (fx1, fy2 - clen), face_color, 3)
                    cv2.line(canvas, (fx2, fy2), (fx2 - clen, fy2), face_color, 3)
                    cv2.line(canvas, (fx2, fy2), (fx2, fy2 - clen), face_color, 3)

                    if is_auth and worker:
                        conf_pct = face_result.get("match_confidence", 95.0)
                        face_tag = f"WORKER: {worker['name'].upper()} ({conf_pct:.0f}%)"
                    elif face_status == "SUSPENDED" and worker:
                        face_tag = f"SUSPENDED: {worker['name'].upper()}"
                    else:
                        face_tag = "UNAUTHORIZED PERSON"

                    font = cv2.FONT_HERSHEY_SIMPLEX
                    font_scale = 0.50
                    (tw, th), _ = cv2.getTextSize(face_tag, font, font_scale, 1)

                    # Place identity label right below chin so it never overlaps the Helmet crown badge
                    by1 = min(h - th - 10, fy2 + 4)
                    by2 = by1 + th + 9
                    bx1 = max(0, fx1)
                    bx2 = min(w, bx1 + tw + 14)

                    cv2.rectangle(canvas, (bx1, by1), (bx2, by2), face_color, -1)
                    cv2.putText(
                        canvas,
                        face_tag,
                        (bx1 + 6, by2 - 5),
                        font,
                        font_scale,
                        (255, 255, 255),
                        1,
                        cv2.LINE_AA,
                    )

            # Update top status banner to reflect combined PPE + Face Authorization decision
            if require_face_auth:
                banner_height = max(36, int(h * 0.045))
                banner_bg = (30, 140, 45) if final_is_compliant else (30, 35, 200)

                if final_is_compliant:
                    wname = worker["name"].upper() if worker else "AUTHORIZED WORKER"
                    banner_text = f"ACCESS GRANTED - {wname} (PPE & FACE VERIFIED)"
                else:
                    reasons: List[str] = []
                    if face_status == "UNAUTHORIZED":
                        reasons.append("UNAUTHORIZED PERSON")
                    elif face_status == "SUSPENDED":
                        reasons.append("PERMIT SUSPENDED")
                    elif face_status == "NO_FACE":
                        reasons.append("FACE NOT DETECTED")

                    if ppe_missing_items:
                        reasons.append("MISSING: " + ", ".join(ppe_missing_items).upper())

                    reason_str = " | ".join(reasons) if reasons else "VERIFICATION FAILED"
                    banner_text = f"ACCESS DENIED - {reason_str}"

                cv2.rectangle(canvas, (0, 0), (w, banner_height), banner_bg, -1)
                font_scale_banner = max(0.45, min(0.70, w / 1300.0))
                cv2.putText(
                    canvas,
                    banner_text,
                    (14, int(banner_height * 0.68)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    font_scale_banner,
                    (255, 255, 255),
                    2,
                    cv2.LINE_AA,
                )

            _, out_buf = cv2.imencode(".jpg", canvas, [cv2.IMWRITE_JPEG_QUALITY, 86])
            out_b64 = base64.b64encode(out_buf.tobytes()).decode("utf-8")
            return f"data:image/jpeg;base64,{out_b64}"
        except Exception as e:
            print(f"[Face Recognition Engine] Overlay warning: {e}")
            return annotated_data_url
