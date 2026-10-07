'use client';
import { FormEvent, useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Copy,
  Check,
  Download,
  Calendar,
  BookOpen,
  CheckCircle2,
  Clock3,
  AlertCircle,
  PhoneCall,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { api, post, API_BASE } from '@/lib/api';
import { Activity, Classroom, User } from '@/types';

type DailyDigest = {
  classroom_id: string;
  classroom_name: string;
  date: string;
  total_faculty: number;
  reported_today: number;
  pending_today: number;
  faculty_statuses: Array<{
    teacher_id: string;
    teacher_name: string;
    teacher_email: string;
    assigned_subject: string;
    assigned_section: string;
    compliance: {
      reported: boolean;
      report_id: string | null;
      source_type: string | null;
      submitted_at: string | null;
      topic: string | null;
      status: string;
    };
  }>;
};

export function ClassroomHub({
  user,
  onOpenVoiceCall,
  onNotify,
  onError,
}: {
  user: User;
  onOpenVoiceCall: () => void;
  onNotify: (msg: string) => void;
  onError: (err: string) => void;
}) {
  const isHodOrAdmin = ['HOD', 'ADMIN', 'COORDINATOR'].includes(user.role);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [mySchedule, setMySchedule] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [digestData, setDigestData] = useState<DailyDigest | null>(null);
  const [showDigestModal, setShowDigestModal] = useState(false);

  // Create form
  const [newClassroomName, setNewClassroomName] = useState('');
  const [newDepartment, setNewDepartment] = useState(user.department || 'CSE');
  const [newYear, setNewYear] = useState('2026-2027');

  // Join form
  const [joinCode, setJoinCode] = useState('');
  const [assignedSubject, setAssignedSubject] = useState('');
  const [assignedSection, setAssignedSection] = useState('CSE-C');

  async function loadData() {
    setLoading(true);
    try {
      const cls = await api<Classroom[]>('/classrooms');
      setClassrooms(cls);
      if (!isHodOrAdmin) {
        const sched = await api<Activity[]>('/classrooms/my-schedule');
        setMySchedule(sched);
      }
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await post<Classroom>('/classrooms', {
        name: newClassroomName,
        department: newDepartment,
        academic_year: newYear,
      });
      onNotify(`Classroom "${created.name}" created! Join Code: ${created.join_code}`);
      setShowCreateModal(false);
      setNewClassroomName('');
      await loadData();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await post<any>('/classrooms/join', {
        join_code: joinCode.trim(),
        assigned_subject: assignedSubject.trim() || undefined,
        assigned_section: assignedSection.trim() || undefined,
      });
      onNotify(res.message || 'Successfully joined classroom!');
      setShowJoinModal(false);
      setJoinCode('');
      await loadData();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copyJoinCode(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    onNotify(`Join Code "${code}" copied to clipboard!`);
    setTimeout(() => setCopiedId(null), 2500);
  }

  async function openDailyDigest(c: Classroom) {
    setBusy(true);
    try {
      const digest = await api<DailyDigest>(`/classrooms/${c.id}/daily-digest`);
      setDigestData(digest);
      setShowDigestModal(true);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function downloadExcel(c: Classroom) {
    window.open(`${API_BASE}/api/classrooms/${c.id}/excel`, '_blank');
    onNotify(`Generating and downloading Master Excel for ${c.name}…`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Banner Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
            {isHodOrAdmin ? 'Department Classrooms & Academic Groups' : 'My Enrolled Classrooms'}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            {isHodOrAdmin
              ? 'Distribute unique join codes to teachers, review daily compliance, and export weekly master plans.'
              : 'Join your HOD’s academic group to view your assigned syllabus and submit daily class reports.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isHodOrAdmin ? (
            <button className="primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Create Classroom
            </button>
          ) : (
            <button className="primary" onClick={() => setShowJoinModal(true)}>
              <Plus size={16} /> Join with Code
            </button>
          )}
        </div>
      </div>

      {loading && <p className="loading">Loading classrooms data…</p>}

      {/* Classrooms Grid */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {classrooms.length === 0 ? (
            <div className="panel" style={{ padding: 40, textAlign: 'center', gridColumn: '1 / -1' }}>
              <Users size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 600, color: '#334155', marginBottom: 6 }}>No Classrooms Found</p>
              <p style={{ fontSize: 12, color: '#64748b', maxWidth: 400, margin: '0 auto 16px' }}>
                {isHodOrAdmin
                  ? 'Create your first classroom group to generate a join code for your department teachers.'
                  : 'Ask your HOD for a classroom Join Code (e.g., CSE-XXXX) and click "Join with Code".'}
              </p>
              {isHodOrAdmin ? (
                <button className="primary" onClick={() => setShowCreateModal(true)}>
                  <Plus size={16} /> Create Classroom
                </button>
              ) : (
                <button className="primary" onClick={() => setShowJoinModal(true)}>
                  <Plus size={16} /> Join Classroom
                </button>
              )}
            </div>
          ) : (
            classrooms.map((c) => (
              <div key={c.id} className="panel" style={{ display: 'flex', flexDirection: 'column', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: '#1e293b' }}>
                      {c.name}
                    </h3>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="badge">{c.department}</span>
                      <span className="badge">{c.academic_year}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {c.members_count} Faculty
                  </span>
                </div>

                {/* Join Code Highlight Card */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                      JOIN CODE FOR TEACHERS
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#2563eb', letterSpacing: '0.08em' }}>
                      {c.join_code}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    style={{ padding: '6px 10px', fontSize: 11 }}
                    onClick={() => copyJoinCode(c.join_code, c.id)}
                    title="Copy Join Code to clipboard"
                  >
                    {copiedId === c.id ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    {copiedId === c.id ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {/* Meta stats */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                  <span>Activities: <b>{c.activities_count}</b></span>
                  <span>Enrolled: <b>{c.members_count}</b></span>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                  {isHodOrAdmin && (
                    <button
                      className="secondary"
                      style={{ flex: 1, padding: '7px 10px', fontSize: 11 }}
                      onClick={() => openDailyDigest(c)}
                    >
                      <UserCheck size={14} /> Daily Digest
                    </button>
                  )}
                  <button
                    className="secondary"
                    style={{ flex: 1, padding: '7px 10px', fontSize: 11 }}
                    onClick={() => downloadExcel(c)}
                  >
                    <Download size={14} /> Weekly Excel
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Teacher's Personal Enrolled Schedule */}
      {!isHodOrAdmin && (
        <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-heading">
            <h2>
              <BookOpen size={18} color="#2563eb" /> Your Assigned Teaching Schedule
            </h2>
            <span>{mySchedule.length} Assigned Activities</span>
          </div>

          {mySchedule.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
              <p>No assigned academic sessions yet. Enter your HOD's join code above to enroll.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Activity Code</th>
                    <th>Course</th>
                    <th>Unit</th>
                    <th>Topic Description</th>
                    <th>Section</th>
                    <th>Planned Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mySchedule.map((a) => (
                    <tr key={a.id}>
                      <td><b>{a.activity_id}</b></td>
                      <td>{a.course}</td>
                      <td>{a.unit}</td>
                      <td>{a.activity_name}</td>
                      <td><span className="badge">{a.class_section}</span></td>
                      <td>{a.planned_start}</td>
                      <td>
                        <span className={`badge ${a.status.toLowerCase()}`}>
                          {a.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: '4px 8px', fontSize: 10 }}
                          onClick={onOpenVoiceCall}
                          title="Report completion via AI voice agent"
                        >
                          <PhoneCall size={12} color="#2563eb" /> Report Progress
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Modal: Create Classroom (HOD) */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true">
            <h2 style={{ marginBottom: 12 }}>Create New Classroom Group</h2>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 12 }}>
              A unique join code (e.g., <code>CSE-402</code>) will be automatically generated for teachers to join.
            </p>
            <form onSubmit={handleCreate}>
              <label>
                Classroom Name
                <input
                  type="text"
                  required
                  placeholder="e.g., CSE 3rd Year - Odd Sem 2026"
                  value={newClassroomName}
                  onChange={(e) => setNewClassroomName(e.target.value)}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Department
                  <input
                    type="text"
                    required
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                  />
                </label>
                <label>
                  Academic Year
                  <input
                    type="text"
                    required
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                  />
                </label>
              </div>
              <div className="actions" style={{ marginTop: 12 }}>
                <button type="button" className="secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={busy || !newClassroomName.trim()}>
                  {busy ? 'Creating…' : 'Generate Group & Code'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal: Join Classroom (Teacher) */}
      {showJoinModal && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true">
            <h2 style={{ marginBottom: 12 }}>Join Classroom Group</h2>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 12 }}>
              Enter the 6-character Join Code provided by your HOD.
            </p>
            <form onSubmit={handleJoin}>
              <label>
                Join Code
                <input
                  type="text"
                  required
                  placeholder="e.g. CSE-7A9B"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Assigned Subject (Optional)
                  <input
                    type="text"
                    placeholder="e.g. Data Structures"
                    value={assignedSubject}
                    onChange={(e) => setAssignedSubject(e.target.value)}
                  />
                </label>
                <label>
                  Assigned Section (Optional)
                  <input
                    type="text"
                    placeholder="e.g. CSE-C"
                    value={assignedSection}
                    onChange={(e) => setAssignedSection(e.target.value)}
                  />
                </label>
              </div>
              <div className="actions" style={{ marginTop: 12 }}>
                <button type="button" className="secondary" onClick={() => setShowJoinModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={busy || !joinCode.trim()}>
                  {busy ? 'Joining…' : 'Join Classroom'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal: Daily Compliance Digest (HOD) */}
      {showDigestModal && digestData && (
        <div className="modal-backdrop">
          <section className="modal" style={{ maxWidth: 680 }} role="dialog" aria-modal="true">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <UserCheck size={20} color="#2563eb" /> Daily Faculty Compliance Digest
              </h2>
              <button className="icon-button" onClick={() => setShowDigestModal(false)}>×</button>
            </div>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 12 }}>
              <b>{digestData.classroom_name}</b> · Date: {digestData.date}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>Total Faculty</span>
                <strong style={{ display: 'block', fontSize: 20, color: '#1e293b' }}>{digestData.total_faculty}</strong>
              </div>
              <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: 11, color: '#166534' }}>Reported Today</span>
                <strong style={{ display: 'block', fontSize: 20, color: '#16a34a' }}>{digestData.reported_today}</strong>
              </div>
              <div style={{ background: '#fffbeb', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid #fde68a' }}>
                <span style={{ fontSize: 11, color: '#92400e' }}>Pending Reports</span>
                <strong style={{ display: 'block', fontSize: 20, color: '#d97706' }}>{digestData.pending_today}</strong>
              </div>
            </div>

            <div className="table-scroll" style={{ maxHeight: 300 }}>
              <table>
                <thead>
                  <tr>
                    <th>Teacher Name</th>
                    <th>Subject</th>
                    <th>Section</th>
                    <th>Status</th>
                    <th>Latest Topic Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {digestData.faculty_statuses.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>
                        No teachers enrolled in this classroom yet. Share the Join Code!
                      </td>
                    </tr>
                  ) : (
                    digestData.faculty_statuses.map((f) => (
                      <tr key={f.teacher_id}>
                        <td><b>{f.teacher_name}</b></td>
                        <td>{f.assigned_subject}</td>
                        <td><span className="badge">{f.assigned_section}</span></td>
                        <td>
                          {f.compliance.reported ? (
                            <span className="badge completed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={10} /> Reported ({f.compliance.source_type || 'WEB'})
                            </span>
                          ) : (
                            <span className="badge unmatched" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Clock3 size={10} /> Pending
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 11 }}>
                          {f.compliance.topic || <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="actions" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="primary" onClick={() => setShowDigestModal(false)}>
                Done
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
