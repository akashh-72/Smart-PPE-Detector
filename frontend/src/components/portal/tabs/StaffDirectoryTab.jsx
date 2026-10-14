import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  UserPlus, 
  Trash2, 
  Search, 
  Filter, 
  HardHat, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  X, 
  Plus,
  ShieldCheck
} from 'lucide-react';
import { getStaff, createStaff, deleteStaff, toggleStaffStatus } from '../../../services/apiService';

export default function StaffDirectoryTab() {
  const [staffList, setStaffList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [newStaff, setNewStaff] = useState({
    name: '',
    employee_id: '',
    department: 'Civil Engineering',
    role: 'Site Specialist',
    required_ppe: ['helmet', 'vest']
  });

  const loadStaffMembers = async () => {
    try {
      const data = await getStaff();
      setStaffList(data || []);
    } catch (err) {
      console.warn("Error loading staff:", err);
      // Fallback default sample staff
      setStaffList([
        { id: 1, name: "Marcus Rivera", employee_id: "EMP-4910", department: "Civil Engineering", role: "Site Supervisor", status: "ACTIVE", required_ppe: ["helmet", "vest"] },
        { id: 2, name: "Elena Chen", employee_id: "EMP-5821", department: "Electrical & Power", role: "High-Voltage Tech", status: "ACTIVE", required_ppe: ["helmet", "vest", "gloves"] },
        { id: 3, name: "David Kim", employee_id: "EMP-3920", department: "Heavy Machinery", role: "Crane Operator", status: "SUSPENDED", required_ppe: ["helmet", "vest", "shoes"] }
      ]);
    }
  };

  useEffect(() => {
    loadStaffMembers();
  }, []);

  const handleToggleStatus = async (staffId) => {
    try {
      await toggleStaffStatus(staffId);
      await loadStaffMembers();
    } catch {
      // Optimistic update
      setStaffList((prev) => 
        prev.map((s) => s.id === staffId ? { ...s, status: s.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : s)
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

  const handleCreateStaffSubmit = async (e) => {
    e.preventDefault();
    if (!newStaff.name.trim() || !newStaff.employee_id.trim()) return;

    setIsSubmitting(true);
    try {
      await createStaff(newStaff);
      setIsAddModalOpen(false);
      setNewStaff({
        name: '',
        employee_id: '',
        department: 'Civil Engineering',
        role: 'Site Specialist',
        required_ppe: ['helmet', 'vest']
      });
      await loadStaffMembers();
    } catch (err) {
      alert("Failed to enroll worker: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStaff = staffList.filter((s) => {
    const matchesDept = selectedDept === 'ALL' || s.department === selectedDept;
    const matchesSearch = 
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const departments = ['ALL', ...new Set(staffList.map((s) => s.department).filter(Boolean))];

  return (
    <div className="portal-staff-suite animate-fadeIn">
      
      {/* Top Welcome Header */}
      <div className="portal-welcome-header">
        <div className="portal-welcome-left">
          <h1>Authorized Personnel Directory</h1>
          <p>
            Manage worker gate access permits, zone authorizations, and individual mandatory safety gear assignments.
          </p>
        </div>

        <div className="portal-welcome-right-actions">
          <button 
            className="skinive-btn-pill-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            <UserPlus size={16} />
            <span>Enroll New Worker</span>
          </button>
        </div>
      </div>

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
          {departments.map((dept) => (
            <button
              key={dept}
              className={`dept-pill-btn ${selectedDept === dept ? 'active' : ''}`}
              onClick={() => setSelectedDept(dept)}
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
          const initials = worker.name ? worker.name.split(' ').map((n) => n[0]).join('').slice(0, 2) : 'EM';

          return (
            <div key={worker.id} className={`staff-worker-card ${isActive ? 'active' : 'suspended'}`}>
              <div className="worker-card-top">
                <div className="worker-avatar-bubble">
                  <span>{initials}</span>
                </div>

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
                  title="Click to toggle status"
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

                <div className="worker-gear-reqs">
                  <span className="gear-tag-label">Required PPE:</span>
                  <div className="gear-pills-row">
                    <span className="gear-micro-pill">Hard Hat</span>
                    <span className="gear-micro-pill">High-Vis Vest</span>
                    {worker.required_ppe?.includes('mask') && <span className="gear-micro-pill">Mask</span>}
                    {worker.required_ppe?.includes('gloves') && <span className="gear-micro-pill">Gloves</span>}
                  </div>
                </div>
              </div>

              <div className="worker-card-footer">
                <button 
                  className="worker-action-link"
                  onClick={() => handleToggleStatus(worker.id)}
                >
                  {isActive ? 'Revoke Access' : 'Reactivate Permit'}
                </button>

                <button 
                  className="worker-delete-btn"
                  onClick={() => handleDeleteStaff(worker.id)}
                  title="Delete record"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enroll Worker Modal */}
      {isAddModalOpen && (
        <div className="analysis-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="analysis-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-col">
                <span className="skinive-section-eyebrow">Personnel Credentialing</span>
                <h3 className="modal-title">Enroll Authorized Site Worker</h3>
              </div>
              <button 
                className="modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaffSubmit} className="enroll-worker-form">
              <div className="form-clean-row">
                <div className="form-clean-field">
                  <label>Full Name <span className="req-star">*</span></label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Marcus Rivera"
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
                    <option value="Electrical & Power">Electrical &amp; Power</option>
                    <option value="Heavy Machinery">Heavy Machinery</option>
                    <option value="HSE & Security">HSE &amp; Security</option>
                    <option value="Subcontractor Crew">Subcontractor Crew</option>
                  </select>
                </div>

                <div className="form-clean-field">
                  <label>Operational Role</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Site Supervisor"
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  />
                </div>
              </div>

              <div className="enroll-actions-row">
                <button 
                  type="button"
                  className="skinive-btn-pill-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  <span>Cancel</span>
                </button>

                <button 
                  type="submit"
                  className="skinive-btn-pill-primary"
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? 'Enrolling...' : 'Register Worker'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
