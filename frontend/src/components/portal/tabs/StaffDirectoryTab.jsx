import React, { useState, useEffect, useRef } from 'react';
import { 
  UserCheck, 
  UserPlus, 
  Trash2, 
  Search, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  X, 
  ShieldCheck,
  ScanFace,
  Camera,
  UploadCloud,
  SwitchCamera,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  Check,
  Edit2
} from 'lucide-react';
import { 
  getStaff, 
  createStaff, 
  updateStaff,
  deleteStaff, 
  toggleStaffStatus,
  validateFaceFrame,
  enrollStaffFace,
  clearStaffFace
} from '../../../services/apiService';

export const WORKSHOP_DESIGNATIONS = [
  'Worker',
  'Welder',
  'Workshop Manager',
  'Manager',
  'Site Supervisor',
  'Safety Officer',
  'Electrician',
  'Technician',
  'Machinist / Fabricator',
  'Quality Inspector',
  'Other / Custom',
];

const PPE_OPTIONS = [
  { id: 'helmet', label: 'Hard Hat' },
  { id: 'vest', label: 'High-Vis Vest' },
  { id: 'mask', label: 'Mask' },
  { id: 'gloves', label: 'Gloves' },
  { id: 'shoes', label: 'Safety Boots' },
];

export default function StaffDirectoryTab({ onNavigateTab }) {
  const [staffList, setStaffList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [faceFilter, setFaceFilter] = useState('ALL'); // 'ALL' | 'ENROLLED' | 'PENDING'
  const [toastBanner, setToastBanner] = useState(null);

  // Modal 1: Add New Worker (+ Optional Immediate Face Scan)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    employee_id: '',
    department: 'Civil Engineering',
    role: 'Worker',
    required_ppe: ['helmet', 'vest']
  });
  const [newCustomRole, setNewCustomRole] = useState('');

  // Modal 2: Scan / Update Face for Existing Worker
  const [faceModalWorker, setFaceModalWorker] = useState(null);
  const [replaceExistingFace, setReplaceExistingFace] = useState(false);

  // Modal 3: Edit Worker Details & Position
  const [editModalWorker, setEditModalWorker] = useState(null);
  const [editStaffData, setEditStaffData] = useState({
    name: '',
    employee_id: '',
    department: 'Civil Engineering',
    role: 'Worker',
    required_ppe: ['helmet', 'vest'],
  });
  const [editCustomRole, setEditCustomRole] = useState('');

  // Shared Biometric Capture State (active inside whichever modal is open)
  const [isCamOpen, setIsCamOpen] = useState(false);
  const [camFacing, setCamFacing] = useState('user');
  const [isValidatingFrame, setIsValidatingFrame] = useState(false);
  const [capturedSamples, setCapturedSamples] = useState([]); // [{ rawBase64, previewUrl, confidence }]
  const [captureError, setCaptureError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileUploadRef = useRef(null);

  const loadStaffMembers = async () => {
    try {
      const data = await getStaff();
      setStaffList(data || []);
    } catch (err) {
      console.warn("Error loading staff:", err);
    }
  };

  useEffect(() => {
    loadStaffMembers();
    return () => stopEnrollmentCamera();
  }, []);

  const showToast = (msg, type = 'success') => {
    setToastBanner({ msg, type });
    setTimeout(() => {
      setToastBanner((prev) => (prev?.msg === msg ? null : prev));
    }, 5500);
  };

  // --- Camera Controls for Biometric Face Enrollment ---
  const stopEnrollmentCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCamOpen(false);
  };

  const startEnrollmentCamera = async (facing = camFacing) => {
    setCaptureError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: facing },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setIsCamOpen(true);
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch (err) {
      setCaptureError('Camera access denied or unavailable. You can also upload a worker face photo.');
      setIsCamOpen(false);
    }
  };

  const handleFlipCamera = async () => {
    const next = camFacing === 'user' ? 'environment' : 'user';
    setCamFacing(next);
    if (isCamOpen) {
      await startEnrollmentCamera(next);
    }
  };

  const handleCaptureLiveFace = async () => {
    if (!videoRef.current || !isCamOpen || isValidatingFrame) return;
    setCaptureError('');
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frameB64 = canvas.toDataURL('image/jpeg', 0.88);

    setIsValidatingFrame(true);
    try {
      const validated = await validateFaceFrame(frameB64);
      setCapturedSamples((prev) => [
        ...prev.slice(-2), // Keep up to 3 crisp biometric samples
        {
          rawBase64: frameB64,
          previewUrl: validated.avatar_data_url,
          confidence: Math.round((validated.face_confidence || 0.96) * 100),
        },
      ]);
    } catch (err) {
      setCaptureError(err.message || 'No clear face detected. Look directly at the camera in good light.');
    } finally {
      setIsValidatingFrame(false);
    }
  };

  const handlePhotoFileSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setCaptureError('');
    setIsValidatingFrame(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result;
        const validated = await validateFaceFrame(dataUrl);
        setCapturedSamples((prev) => [
          ...prev.slice(-2),
          {
            rawBase64: dataUrl,
            previewUrl: validated.avatar_data_url,
            confidence: Math.round((validated.face_confidence || 0.96) * 100),
          },
        ]);
      } catch (err) {
        setCaptureError(err.message || 'Could not detect a clear face in uploaded photo.');
      } finally {
        setIsValidatingFrame(false);
        if (fileUploadRef.current) fileUploadRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setCaptureError('Failed to read selected image file.');
      setIsValidatingFrame(false);
    };
    reader.readAsDataURL(file);
  };

  const removeSampleAt = (idx) => {
    setCapturedSamples((prev) => prev.filter((_, i) => i !== idx));
  };

  // --- Modal Lifecycle Helpers ---
  const openAddWorkerModal = () => {
    stopEnrollmentCamera();
    setCapturedSamples([]);
    setCaptureError('');
    const randNum = Math.floor(1000 + Math.random() * 8999);
    setNewStaff({
      name: '',
      employee_id: `EMP-${randNum}`,
      department: 'Civil Engineering',
      role: 'Worker',
      required_ppe: ['helmet', 'vest'],
    });
    setNewCustomRole('');
    setIsAddModalOpen(true);
  };

  const closeAddWorkerModal = () => {
    stopEnrollmentCamera();
    setCapturedSamples([]);
    setCaptureError('');
    setIsAddModalOpen(false);
  };

  const openScanFaceModal = (worker) => {
    stopEnrollmentCamera();
    setCapturedSamples([]);
    setCaptureError('');
    setReplaceExistingFace(false);
    setFaceModalWorker(worker);
    startEnrollmentCamera('user');
  };

  const closeScanFaceModal = () => {
    stopEnrollmentCamera();
    setCapturedSamples([]);
    setCaptureError('');
    setFaceModalWorker(null);
  };

  // --- Modal 3: Edit Worker Details Helpers ---
  const openEditWorkerModal = (worker) => {
    const isStandard = WORKSHOP_DESIGNATIONS.includes(worker.role);
    setEditModalWorker(worker);
    setEditStaffData({
      name: worker.name,
      employee_id: worker.employee_id,
      department: worker.department || 'Civil Engineering',
      role: isStandard ? worker.role : 'Other / Custom',
      required_ppe: worker.required_ppe && worker.required_ppe.length > 0 ? worker.required_ppe : ['helmet', 'vest'],
    });
    setEditCustomRole(isStandard ? '' : (worker.role || ''));
  };

  const closeEditWorkerModal = () => {
    setEditModalWorker(null);
  };

  const toggleEditStaffPpe = (gearId) => {
    setEditStaffData((prev) => {
      const exists = prev.required_ppe.includes(gearId);
      if (exists && prev.required_ppe.length <= 1) return prev;
      return {
        ...prev,
        required_ppe: exists
          ? prev.required_ppe.filter((x) => x !== gearId)
          : [...prev.required_ppe, gearId],
      };
    });
  };

  const handleEditStaffSubmit = async (e) => {
    e.preventDefault();
    if (!editModalWorker || !editStaffData.name.trim() || !editStaffData.employee_id.trim()) return;

    setIsSubmitting(true);
    try {
      const finalRole = editStaffData.role === 'Other / Custom' ? (editCustomRole.trim() || 'Worker') : editStaffData.role;
      const updated = await updateStaff(editModalWorker.id, {
        name: editStaffData.name.trim(),
        employee_id: editStaffData.employee_id.trim(),
        department: editStaffData.department,
        role: finalRole,
        required_ppe: editStaffData.required_ppe,
      });
      closeEditWorkerModal();
      await loadStaffMembers();
      showToast(`Updated ${updated.name}'s profile. Designation: ${updated.role}`);
    } catch (err) {
      alert(err.message || 'Failed to update worker details');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Staff CRUD & Biometric Save Actions ---
  const toggleNewStaffPpe = (gearId) => {
    setNewStaff((prev) => {
      const exists = prev.required_ppe.includes(gearId);
      if (exists && prev.required_ppe.length <= 1) return prev;
      return {
        ...prev,
        required_ppe: exists
          ? prev.required_ppe.filter((x) => x !== gearId)
          : [...prev.required_ppe, gearId],
      };
    });
  };

  const handleCreateStaffSubmit = async (e) => {
    e.preventDefault();
    if (!newStaff.name.trim() || !newStaff.employee_id.trim()) return;

    setIsSubmitting(true);
    setCaptureError('');
    try {
      const finalRole = newStaff.role === 'Other / Custom' ? (newCustomRole.trim() || 'Worker') : newStaff.role;
      const payload = {
        ...newStaff,
        role: finalRole,
        face_images_base64: capturedSamples.map((s) => s.rawBase64),
      };
      const created = await createStaff(payload);
      closeAddWorkerModal();
      await loadStaffMembers();
      if (created.face_registered) {
        showToast(`Enrolled ${created.role} ${created.name} (${created.employee_id}) with Biometric Face ID! Ready for Gate Scan.`);
      } else {
        showToast(`Registered ${created.role} ${created.name} (${created.employee_id}). Click "Scan Face" anytime to add face biometrics.`);
      }
    } catch (err) {
      setCaptureError(err.message || 'Failed to register worker');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveWorkerFaceSubmit = async () => {
    if (!faceModalWorker || capturedSamples.length === 0) {
      setCaptureError('Please capture at least 1 clear face scan or upload a face photo first.');
      return;
    }

    setIsSubmitting(true);
    setCaptureError('');
    try {
      const imgs = capturedSamples.map((s) => s.rawBase64);
      const res = await enrollStaffFace(faceModalWorker.id, imgs, replaceExistingFace);
      const wName = res.staff?.name || faceModalWorker.name;
      closeScanFaceModal();
      await loadStaffMembers();
      showToast(`Biometric Face ID saved for ${wName}! Worker will now be recognized automatically at the gate.`);
    } catch (err) {
      setCaptureError(err.message || 'Failed to save worker face data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetWorkerFace = async (worker) => {
    if (!window.confirm(`Clear stored biometric face data for ${worker.name}?`)) return;
    try {
      await clearStaffFace(worker.id);
      await loadStaffMembers();
      showToast(`Cleared biometric face profile for ${worker.name}.`);
    } catch (err) {
      alert(err.message || 'Failed to clear face data');
    }
  };

  const handleToggleStatus = async (staffId) => {
    try {
      await toggleStaffStatus(staffId);
      await loadStaffMembers();
    } catch {
      setStaffList((prev) => 
        prev.map((s) => s.id === staffId ? { ...s, status: s.status === 'ACTIVE' ? 'RESTRICTED' : 'ACTIVE' } : s)
      );
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm("Remove authorized worker from site gate directory?")) return;
    try {
      await deleteStaff(staffId);
      await loadStaffMembers();
    } catch {
      setStaffList((prev) => prev.filter((s) => s.id !== staffId));
    }
  };

  const enrolledCount = staffList.filter((s) => s.face_registered).length;

  const filteredStaff = staffList.filter((s) => {
    const matchesDept = selectedDept === 'ALL' || s.department === selectedDept;
    const matchesFace =
      faceFilter === 'ALL' ||
      (faceFilter === 'ENROLLED' && s.face_registered) ||
      (faceFilter === 'PENDING' && !s.face_registered);
    const matchesSearch = 
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.role && s.role.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesDept && matchesFace && matchesSearch;
  });

  const departments = ['ALL', ...new Set(staffList.map((s) => s.department).filter(Boolean))];

  // Shared Biometric Capture Section UI used inside both modals
  const renderBiometricCapturePanel = (isCompact = false) => (
    <div className={`biometric-capture-box ${isCompact ? 'compact' : ''}`}>
      <div className="biometric-capture-top">
        <div className="biometric-capture-heading">
          <ScanFace size={17} color="#FF5E14" />
          <div>
            <strong>Worker Face Biometric Capture</strong>
            <span>128-D SFace Neural Identity Signature (Works with or without helmet)</span>
          </div>
        </div>

        <div className="biometric-capture-btns">
          <button
            type="button"
            className={`bio-mode-btn ${isCamOpen ? 'active' : ''}`}
            onClick={() => (isCamOpen ? stopEnrollmentCamera() : startEnrollmentCamera())}
          >
            <Camera size={14} />
            <span>{isCamOpen ? 'Stop Camera' : 'Use Live Camera'}</span>
          </button>

          <button
            type="button"
            className="bio-mode-btn"
            onClick={() => fileUploadRef.current && fileUploadRef.current.click()}
          >
            <UploadCloud size={14} />
            <span>Upload Photo</span>
          </button>

          <input
            ref={fileUploadRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoFileSelect}
          />
        </div>
      </div>

      {/* Live Camera Viewport when active */}
      {isCamOpen && (
        <div className="bio-webcam-stage">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="bio-webcam-video"
          />
          <div className="bio-face-oval-guide">
            <span className="bio-guide-caption">ALIGN FACE IN FRAME</span>
          </div>

          <div className="bio-webcam-controls">
            <button
              type="button"
              className="bio-capture-trigger-btn"
              onClick={handleCaptureLiveFace}
              disabled={isValidatingFrame}
            >
              <ScanFace size={16} />
              <span>
                {isValidatingFrame
                  ? 'Detecting Face...'
                  : capturedSamples.length > 0
                  ? 'Capture Another Angle'
                  : 'Capture Worker Face'}
              </span>
            </button>

            <button
              type="button"
              className="bio-flip-cam-btn"
              onClick={handleFlipCamera}
              title="Flip Front/Rear Camera"
            >
              <SwitchCamera size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Error / Lighting Hint */}
      {captureError && (
        <div className="bio-error-banner">
          <AlertCircle size={15} />
          <span>{captureError}</span>
        </div>
      )}

      {/* Captured Verified Face Thumbnails */}
      {capturedSamples.length > 0 ? (
        <div className="bio-samples-strip">
          <div className="bio-samples-header">
            <span className="bio-samples-ok">
              <CheckCircle2 size={14} />
              {capturedSamples.length} Verified Face {capturedSamples.length === 1 ? 'Sample' : 'Samples'} Ready
            </span>
            <span className="bio-samples-hint">Tip: 1 scan is enough, or add 2–3 angles for extra precision</span>
          </div>
          <div className="bio-samples-list">
            {capturedSamples.map((sample, idx) => (
              <div key={idx} className="bio-sample-thumb-card">
                <img src={sample.previewUrl} alt={`Face sample ${idx + 1}`} />
                <span className="bio-sample-conf">{sample.confidence}%</span>
                <button
                  type="button"
                  className="bio-sample-remove"
                  onClick={() => removeSampleAt(idx)}
                  title="Remove sample"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !isCamOpen && (
          <div className="bio-empty-prompt">
            <span>
              Click <strong>Use Live Camera</strong> to scan the worker&apos;s face now, or <strong>Upload Photo</strong>.
              {isCompact && ' (Optional — you can also scan their face later from the worker card.)'}
            </span>
          </div>
        )
      )}
    </div>
  );

  return (
    <div className="portal-staff-suite animate-fadeIn">
      
      {/* Top Welcome Header */}
      <div className="portal-welcome-header">
        <div className="portal-welcome-left">
          <div className="staff-header-title-row">
            <h1>Authorized Worker &amp; Face ID Directory</h1>
            <span className="staff-biometric-summary-pill">
              <ScanFace size={14} />
              <span>{enrolledCount} / {staffList.length} Face IDs Enrolled</span>
            </span>
          </div>
          <p>
            Enroll authorized workers with biometric face data so the Gate Scanner simultaneously verifies both mandatory PPE and worker identity.
          </p>
        </div>

        <div className="portal-welcome-right-actions">
          <button 
            className="skinive-btn-pill-primary"
            onClick={openAddWorkerModal}
          >
            <UserPlus size={16} />
            <span>Add Worker &amp; Scan Face</span>
          </button>
        </div>
      </div>

      {/* Confirmation Toast Banner with Quick Link to Gate Scanner */}
      {toastBanner && (
        <div className="staff-toast-banner animate-fadeIn">
          <div className="staff-toast-left">
            <CheckCircle2 size={18} />
            <span>{toastBanner.msg}</span>
          </div>
          {onNavigateTab && (
            <button
              className="staff-toast-goto-btn"
              onClick={() => onNavigateTab('scanner')}
            >
              <span>Test at Gate Scanner</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="staff-filter-toolbar">
        <div className="staff-search-input-wrap">
          <Search size={15} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by worker name, employee ID, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="staff-dept-filter-pills">
          <button
            className={`dept-pill-btn ${faceFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFaceFilter('ALL')}
          >
            All Personnel ({staffList.length})
          </button>
          <button
            className={`dept-pill-btn ${faceFilter === 'ENROLLED' ? 'active' : ''}`}
            onClick={() => setFaceFilter('ENROLLED')}
          >
            ✓ Face Enrolled ({enrolledCount})
          </button>
          <button
            className={`dept-pill-btn ${faceFilter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setFaceFilter('PENDING')}
          >
            Face Not Scanned ({staffList.length - enrolledCount})
          </button>

          <span className="staff-filter-sep">|</span>

          {departments.filter((d) => d !== 'ALL').map((dept) => (
            <button
              key={dept}
              className={`dept-pill-btn ${selectedDept === dept ? 'active' : ''}`}
              onClick={() => setSelectedDept(selectedDept === dept ? 'ALL' : dept)}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Worker Cards Grid */}
      <div className="staff-cards-grid">
        {filteredStaff.map((worker) => {
          const isActive = worker.status === 'ACTIVE' || worker.is_active;
          const hasFace = Boolean(worker.face_registered);
          const initials = worker.name ? worker.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'WK';

          return (
            <div key={worker.id} className={`staff-worker-card ${isActive ? 'active' : 'suspended'}`}>
              <div className="worker-card-top">
                {hasFace && worker.face_image ? (
                  <div className="worker-avatar-photo-wrap enrolled" title="Biometric Face Enrolled">
                    <img src={worker.face_image} alt={worker.name} className="worker-avatar-photo" />
                    <span className="worker-face-verified-dot">
                      <Check size={9} strokeWidth={3.5} />
                    </span>
                  </div>
                ) : (
                  <div
                    className="worker-avatar-bubble"
                    style={worker.avatar_bg ? { background: worker.avatar_bg } : undefined}
                  >
                    <span>{initials}</span>
                  </div>
                )}

                <div className="worker-meta-col">
                  <h4 className="worker-name">{worker.name}</h4>
                  <div className="worker-id-badge">
                    <code>{worker.employee_id}</code>
                    <span className="worker-role-dot">•</span>
                    <span className="worker-role">{worker.role || 'Site Operator'}</span>
                  </div>
                </div>

                <button 
                  className={`worker-status-badge ${isActive ? 'active' : 'suspended'}`}
                  onClick={() => handleToggleStatus(worker.id)}
                  title="Click to toggle permit status"
                >
                  {isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  <span>{isActive ? 'PERMIT ACTIVE' : 'SUSPENDED'}</span>
                </button>
              </div>

              <div className="worker-card-body">
                <div className="worker-dept-row">
                  <Building2 size={14} color="#64748B" />
                  <span>{worker.department || 'Operations'}</span>
                </div>

                {/* Biometric Face Status Row */}
                <div className="worker-biometric-status-row">
                  {hasFace ? (
                    <div className="worker-face-pill enrolled">
                      <ScanFace size={13} />
                      <span>
                        FACE ID ENROLLED ({worker.face_samples_count || 1}{' '}
                        {(worker.face_samples_count || 1) === 1 ? 'sample' : 'samples'})
                      </span>
                    </div>
                  ) : (
                    <div className="worker-face-pill pending">
                      <ScanFace size={13} />
                      <span>FACE NOT SCANNED YET</span>
                    </div>
                  )}

                  {hasFace && (
                    <button
                      type="button"
                      className="worker-clear-face-link"
                      onClick={() => handleResetWorkerFace(worker)}
                      title="Clear stored face biometrics"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="worker-gear-reqs">
                  <span className="gear-tag-label">Required PPE:</span>
                  <div className="gear-pills-row">
                    {(worker.required_ppe && worker.required_ppe.length > 0
                      ? worker.required_ppe
                      : ['helmet', 'vest']
                    ).map((gear) => (
                      <span key={gear} className="gear-micro-pill">
                        {gear === 'helmet'
                          ? 'Hard Hat'
                          : gear === 'vest'
                          ? 'High-Vis Vest'
                          : gear.charAt(0).toUpperCase() + gear.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="worker-card-footer">
                {/* Primary Biometric Scan/Update Face Button */}
                <button
                  type="button"
                  className={`worker-scan-face-btn ${hasFace ? 'update' : 'primary'}`}
                  onClick={() => openScanFaceModal(worker)}
                >
                  <ScanFace size={14} />
                  <span>{hasFace ? 'Update / Scan Face' : 'Scan Face Now'}</span>
                </button>

                <div className="worker-footer-right-actions">
                  <button 
                    type="button"
                    className="worker-action-link"
                    onClick={() => openEditWorkerModal(worker)}
                    title="Edit Designation & Details"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button 
                    className="worker-action-link"
                    onClick={() => handleToggleStatus(worker.id)}
                  >
                    {isActive ? 'Revoke' : 'Activate'}
                  </button>

                  <button 
                    className="worker-delete-btn"
                    onClick={() => handleDeleteStaff(worker.id)}
                    title="Delete worker record"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: Add New Worker + Face Biometric Enrollment */}
      {isAddModalOpen && (
        <div className="analysis-modal-backdrop" onClick={closeAddWorkerModal}>
          <div className="analysis-modal-content biometric-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-col">
                <span className="skinive-section-eyebrow">Personnel &amp; Biometric Credentialing</span>
                <h3 className="modal-title">Enroll Authorized Worker &amp; Face ID</h3>
              </div>
              <button 
                className="modal-close-btn"
                onClick={closeAddWorkerModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaffSubmit} className="enroll-worker-form">
              <div className="form-clean-row">
                <div className="form-clean-field">
                  <label>Worker Full Name <span className="req-star">*</span></label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Akash Patil"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  />
                </div>

                <div className="form-clean-field">
                  <label>Employee / Gate Badge ID <span className="req-star">*</span></label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. EMP-9482"
                    value={newStaff.employee_id}
                    onChange={(e) => setNewStaff({ ...newStaff, employee_id: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-clean-row">
                <div className="form-clean-field">
                  <label>Department</label>
                  <select 
                    value={newStaff.department}
                    onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })}
                  >
                    <option value="Civil Engineering">Civil Engineering</option>
                    <option value="Construction Operations">Construction Operations</option>
                    <option value="Electrical & Power">Electrical &amp; Power</option>
                    <option value="Heavy Machinery">Heavy Machinery</option>
                    <option value="Quality & Safety">Quality &amp; Safety</option>
                    <option value="Logistics & Supply">Logistics &amp; Supply</option>
                  </select>
                </div>

                <div className="form-clean-field">
                  <label>Position / Designation <span className="req-star">*</span></label>
                  <select 
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  >
                    {WORKSHOP_DESIGNATIONS.map((desig) => (
                      <option key={desig} value={desig}>{desig}</option>
                    ))}
                  </select>
                </div>
              </div>

              {newStaff.role === 'Other / Custom' && (
                <div className="form-clean-field" style={{ marginBottom: '1rem' }}>
                  <label>Custom Designation Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Lead Pipefitter / CNC Specialist"
                    value={newCustomRole}
                    onChange={(e) => setNewCustomRole(e.target.value)}
                  />
                </div>
              )}

              {/* Mandatory PPE Checkboxes */}
              <div className="form-clean-field">
                <label>Assigned Mandatory PPE</label>
                <div className="ppe-select-pills-row">
                  {PPE_OPTIONS.map((opt) => {
                    const active = newStaff.required_ppe.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`ppe-select-pill ${active ? 'selected' : ''}`}
                        onClick={() => toggleNewStaffPpe(opt.id)}
                      >
                        {active && <Check size={12} />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Integrated Face Capture Section */}
              {renderBiometricCapturePanel(true)}

              <div className="enroll-actions-row">
                <button 
                  type="button"
                  className="skinive-btn-pill-secondary"
                  onClick={closeAddWorkerModal}
                >
                  <span>Cancel</span>
                </button>

                <button 
                  type="submit"
                  className="skinive-btn-pill-primary"
                  disabled={isSubmitting}
                >
                  <UserCheck size={16} />
                  <span>
                    {isSubmitting
                      ? 'Saving Worker...'
                      : capturedSamples.length > 0
                      ? 'Register Worker & Enroll Face'
                      : 'Register Worker (Scan Face Later)'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Dedicated Scan / Update Face Modal for Existing Worker */}
      {faceModalWorker && (
        <div className="analysis-modal-backdrop" onClick={closeScanFaceModal}>
          <div className="analysis-modal-content biometric-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-col">
                <span className="skinive-section-eyebrow">Biometric Face Enrollment</span>
                <h3 className="modal-title">
                  Scan Face for {faceModalWorker.name}{' '}
                  <span className="modal-emp-code">({faceModalWorker.employee_id})</span>
                </h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={closeScanFaceModal}
              >
                <X size={18} />
              </button>
            </div>

            <div className="enroll-worker-form">
              {renderBiometricCapturePanel(false)}

              {faceModalWorker.face_registered && (
                <label className="bio-replace-checkbox-row">
                  <input
                    type="checkbox"
                    checked={replaceExistingFace}
                    onChange={(e) => setReplaceExistingFace(e.target.checked)}
                  />
                  <span>
                    Replace previous face scans completely (leave unchecked to add new angles to existing profile)
                  </span>
                </label>
              )}

              <div className="enroll-actions-row">
                <button
                  type="button"
                  className="skinive-btn-pill-secondary"
                  onClick={closeScanFaceModal}
                >
                  <span>Cancel</span>
                </button>

                <button
                  type="button"
                  className="skinive-btn-pill-primary"
                  disabled={isSubmitting || capturedSamples.length === 0}
                  onClick={handleSaveWorkerFaceSubmit}
                >
                  <ShieldCheck size={16} />
                  <span>
                    {isSubmitting
                      ? 'Enrolling Face...'
                      : `Save Face Data (${capturedSamples.length} ${capturedSamples.length === 1 ? 'Sample' : 'Samples'})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Worker Details & Position Modal */}
      {editModalWorker && (
        <div className="analysis-modal-backdrop" onClick={closeEditWorkerModal}>
          <div className="analysis-modal-content biometric-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-col">
                <span className="skinive-section-eyebrow">Personnel Directory Management</span>
                <h3 className="modal-title">Edit Worker Details &amp; Designation</h3>
              </div>
              <button 
                className="modal-close-btn"
                onClick={closeEditWorkerModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditStaffSubmit} className="enroll-worker-form">
              <div className="form-clean-row">
                <div className="form-clean-field">
                  <label>Worker Full Name <span className="req-star">*</span></label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Akash Patil"
                    value={editStaffData.name}
                    onChange={(e) => setEditStaffData({ ...editStaffData, name: e.target.value })}
                  />
                </div>

                <div className="form-clean-field">
                  <label>Employee / Gate Badge ID <span className="req-star">*</span></label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. EMP-9482"
                    value={editStaffData.employee_id}
                    onChange={(e) => setEditStaffData({ ...editStaffData, employee_id: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-clean-row">
                <div className="form-clean-field">
                  <label>Department</label>
                  <select 
                    value={editStaffData.department}
                    onChange={(e) => setEditStaffData({ ...editStaffData, department: e.target.value })}
                  >
                    <option value="Civil Engineering">Civil Engineering</option>
                    <option value="Construction Operations">Construction Operations</option>
                    <option value="Electrical & Power">Electrical &amp; Power</option>
                    <option value="Heavy Machinery">Heavy Machinery</option>
                    <option value="Quality & Safety">Quality &amp; Safety</option>
                    <option value="Logistics & Supply">Logistics &amp; Supply</option>
                  </select>
                </div>

                <div className="form-clean-field">
                  <label>Position / Designation <span className="req-star">*</span></label>
                  <select 
                    value={editStaffData.role}
                    onChange={(e) => setEditStaffData({ ...editStaffData, role: e.target.value })}
                  >
                    {WORKSHOP_DESIGNATIONS.map((desig) => (
                      <option key={desig} value={desig}>{desig}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editStaffData.role === 'Other / Custom' && (
                <div className="form-clean-field" style={{ marginBottom: '1rem' }}>
                  <label>Custom Designation Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Lead Pipefitter / CNC Specialist"
                    value={editCustomRole}
                    onChange={(e) => setEditCustomRole(e.target.value)}
                  />
                </div>
              )}

              {/* Mandatory PPE Checkboxes */}
              <div className="form-clean-field">
                <label>Assigned Mandatory PPE</label>
                <div className="ppe-select-pills-row">
                  {PPE_OPTIONS.map((opt) => {
                    const active = editStaffData.required_ppe.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`ppe-select-pill ${active ? 'selected' : ''}`}
                        onClick={() => toggleEditStaffPpe(opt.id)}
                      >
                        {active && <Check size={12} />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="enroll-actions-row">
                <button 
                  type="button"
                  className="skinive-btn-pill-secondary"
                  onClick={closeEditWorkerModal}
                >
                  <span>Cancel</span>
                </button>

                <button 
                  type="submit"
                  className="skinive-btn-pill-primary"
                  disabled={isSubmitting}
                >
                  <CheckCircle2 size={16} />
                  <span>{isSubmitting ? 'Saving Changes...' : 'Save Worker Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
