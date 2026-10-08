'use client';
import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, Plus, Copy, Check, Download, Calendar,
  BookOpen, CheckCircle2, Clock3, AlertCircle, PhoneCall,
  Sparkles, UserCheck, Pencil, Trash2, X, ChevronRight, Hash
} from 'lucide-react';
import { api, post, patch, del, API_BASE } from '@/lib/api';
import { Activity, Classroom, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showDigestModal, setShowDigestModal] = useState(false);

  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [digestData, setDigestData] = useState<DailyDigest | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);

  // Create form
  const [newClassroomName, setNewClassroomName] = useState('');
  const [newDepartment, setNewDepartment] = useState(user.department || 'CSE');
  const [newYear, setNewYear] = useState('2026-2027');
  const [createSaving, setCreateSaving] = useState(false);

  // Join form
  const [joinCode, setJoinCode] = useState('');
  const [assignedSubject, setAssignedSubject] = useState('');
  const [assignedSection, setAssignedSection] = useState('CSE-C');
  const [joinSaving, setJoinSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (!newClassroomName.trim()) {
      onError('Please enter a classroom name');
      return;
    }
    setCreateSaving(true);
    try {
      const created = await post<Classroom>('/classrooms', {
        name: newClassroomName.trim(),
        department: newDepartment,
        academic_year: newYear,
      });
      onNotify(`Classroom "${created.name}" created with Join Code: ${created.join_code}`);
      setShowCreateModal(false);
      setNewClassroomName('');
      loadData();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setCreateSaving(false);
    }
  }

  function openEditModal(c: Classroom) {
    setEditingClassroom(c);
    setEditName(c.name);
    setEditDept(c.department);
    setEditYear(c.academic_year);
    setShowEditModal(true);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingClassroom) return;
    if (!editName.trim()) {
      onError('Classroom name cannot be empty');
      return;
    }
    setEditSaving(true);
    try {
      const updated = await patch<Classroom>(`/classrooms/${editingClassroom.id}`, {
        name: editName.trim(),
        department: editDept.trim(),
        academic_year: editYear.trim(),
      });
      setClassrooms(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      onNotify(`Classroom updated to "${updated.name}" successfully!`);
      setShowEditModal(false);
      setEditingClassroom(null);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteClassroom(c: Classroom) {
    if (!confirm(`Are you sure you want to delete classroom "${c.name}"?`)) return;
    try {
      await del(`/classrooms/${c.id}`);
      setClassrooms(prev => prev.filter(item => item.id !== c.id));
      onNotify(`Classroom "${c.name}" removed successfully.`);
      setShowEditModal(false);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) {
      onError('Please enter a join code');
      return;
    }
    setJoinSaving(true);
    try {
      const res = await post<any>('/classrooms/join', {
        join_code: joinCode.trim().toUpperCase(),
        assigned_subject: assignedSubject.trim() || undefined,
        assigned_section: assignedSection.trim() || undefined,
      });
      onNotify(`Successfully enrolled in "${res.classroom_name}"!`);
      setShowJoinModal(false);
      setJoinCode('');
      loadData();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setJoinSaving(false);
    }
  }

  async function openDailyDigest(c: Classroom) {
    setSelectedClassroom(c);
    setShowDigestModal(true);
    setDigestLoading(true);
    setDigestData(null);
    try {
      const data = await api<DailyDigest>(`/classrooms/${c.id}/daily-digest`);
      setDigestData(data);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setDigestLoading(false);
    }
  }

  function copyJoinCode(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    onNotify(`Copied Join Code "${code}" to clipboard! Share with your teachers.`);
    setTimeout(() => setCopiedId(null), 3000);
  }

  function downloadExcel(c: Classroom) {
    window.open(`${API_BASE}/api/classrooms/${c.id}/excel`, '_blank');
    onNotify(`Generating and downloading Master Excel for ${c.name}…`);
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-border-subtle p-6 shadow-xs">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">
            Institutional Roster
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            {isHodOrAdmin ? 'Department Classrooms & Academic Groups' : 'My Enrolled Classrooms'}
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
            {isHodOrAdmin
              ? 'Distribute unique join codes to teachers, review daily compliance, and export weekly master plans.'
              : 'Join your HOD’s academic group to view your assigned syllabus and submit daily class reports.'}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {isHodOrAdmin ? (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold px-4 py-2.5 shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} /> Create Classroom
            </Button>
          ) : (
            <Button
              onClick={() => setShowJoinModal(true)}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold px-4 py-2.5 shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} /> Join with Code
            </Button>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border-subtle p-6 shadow-xs flex flex-col space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-3/4 rounded-lg" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-12 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-16 w-full rounded-xl" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Classrooms Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-border-subtle p-12 text-center">
              <Users size={40} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-sm font-bold text-text-primary mb-1">No Classrooms Found</h3>
              <p className="text-xs text-text-muted max-w-md mx-auto mb-6">
                {isHodOrAdmin
                  ? 'Create your first classroom group to generate a join code for your department teachers.'
                  : 'Ask your HOD for a classroom Join Code (e.g., CSE-XXXX) and click "Join with Code".'}
              </p>
              {isHodOrAdmin ? (
                <Button onClick={() => setShowCreateModal(true)} className="rounded-xl text-xs">
                  <Plus size={15} /> Create Classroom
                </Button>
              ) : (
                <Button onClick={() => setShowJoinModal(true)} className="rounded-xl text-xs">
                  <Plus size={15} /> Join Classroom
                </Button>
              )}
            </div>
          ) : (
            classrooms.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-border-subtle p-6 shadow-xs hover:shadow-md transition-all flex flex-col group relative"
              >
                {/* Header: Name, Edit Button, Badges */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h2 className="text-base font-bold text-text-primary truncate" title={c.name}>
                        {c.name}
                      </h2>
                      {isHodOrAdmin && (
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1 text-text-muted hover:text-primary rounded-md hover:bg-slate-100 transition-colors"
                          title="Edit classroom name & details"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {c.department}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {c.academic_year}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-text-muted bg-slate-50 border border-border-subtle px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1">
                    <Users size={12} className="text-primary" /> {c.members_count} Faculty
                  </span>
                </div>

                {/* Join Code Highlight Card */}
                <div className="bg-blue-50/50 border border-blue-200 border-dashed rounded-xl p-3.5 flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[9px] font-extrabold text-blue-800 tracking-wider uppercase">
                      TEACHER JOIN CODE
                    </div>
                    <div className="text-lg font-mono font-extrabold text-primary tracking-wider mt-0.5">
                      {c.join_code}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyJoinCode(c.join_code, c.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-border-subtle text-xs font-semibold hover:bg-slate-50 text-text-primary flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    title="Copy Join Code to clipboard"
                  >
                    {copiedId === c.id ? (
                      <>
                        <Check size={13} className="text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Meta stats */}
                <div className="grid grid-cols-2 gap-2 text-xs text-text-muted p-2.5 bg-slate-50/80 rounded-xl mb-4 border border-border-subtle/50">
                  <div className="flex items-center gap-1.5">
                    <BookOpen size={13} className="text-primary shrink-0" />
                    <span>Activities: <strong className="text-text-primary">{c.activities_count}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserCheck size={13} className="text-emerald-600 shrink-0" />
                    <span>Enrolled: <strong className="text-text-primary">{c.members_count}</strong></span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-auto pt-2">
                  {isHodOrAdmin && (
                    <button
                      onClick={() => openDailyDigest(c)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <UserCheck size={14} className="text-primary" /> Daily Digest
                    </button>
                  )}
                  <button
                    onClick={() => downloadExcel(c)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download size={14} className="text-emerald-600" /> Weekly Excel
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Teacher's Personal Enrolled Schedule */}
      {!isHodOrAdmin && (
        <section className="bg-white rounded-2xl border border-border-subtle p-6 shadow-xs mt-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-4">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <BookOpen size={18} className="text-primary" /> Your Assigned Teaching Schedule
            </h2>
            <span className="text-xs font-semibold text-text-muted">
              {mySchedule.length} Assigned Activities
            </span>
          </div>

          {mySchedule.length === 0 ? (
            <div className="p-8 text-center text-text-muted">
              <p className="text-xs">No assigned academic sessions yet. Enter your HOD's join code above to enroll.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-slate-50/60 text-text-muted font-semibold">
                    <th className="py-2.5 px-3">Activity Code</th>
                    <th className="py-2.5 px-3">Course</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3">Topic Description</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3">Planned Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {mySchedule.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-primary">{a.activity_id}</td>
                      <td className="py-2.5 px-3 font-semibold">{a.course}</td>
                      <td className="py-2.5 px-3 text-text-muted">{a.unit}</td>
                      <td className="py-2.5 px-3">{a.activity_name}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">{a.class_section}</span>
                      </td>
                      <td className="py-2.5 px-3 text-text-muted">{a.planned_start}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                          a.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={onOpenVoiceCall}
                          className="px-2 py-1 bg-primary-light hover:bg-primary-light/80 text-primary font-semibold rounded-lg flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          <PhoneCall size={11} /> Report
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

      {/* --- CREATE CLASSROOM MODAL (Portaled to document.body) --- */}
      {mounted && showCreateModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-border-subtle max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 relative my-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <h2 className="text-base font-bold text-text-primary mb-1 flex items-center gap-2">
              <Plus size={18} className="text-primary" /> Create Department Classroom
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Create an academic group to generate a unique teacher join code and track curriculum compliance.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Classroom Name:
                </label>
                <input
                  type="text"
                  value={newClassroomName}
                  onChange={(e) => setNewClassroomName(e.target.value)}
                  placeholder="e.g., Computer Science Core (CSE-2026)"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Department:
                  </label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Academic Year:
                  </label>
                  <input
                    type="text"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createSaving} className="bg-primary hover:bg-primary/90 text-white">
                  {createSaving ? 'Creating…' : 'Create & Generate Code'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- EDIT CLASSROOM MODAL (Portaled to document.body) --- */}
      {mounted && showEditModal && editingClassroom && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-border-subtle max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 relative my-auto">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <h2 className="text-base font-bold text-text-primary mb-1 flex items-center gap-2">
              <Pencil size={18} className="text-primary" /> Edit Classroom Details
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Update classroom title, department tag, or academic year.
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Classroom Name:
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g., CSE III Year - Section C"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Department:
                  </label>
                  <input
                    type="text"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Academic Year:
                  </label>
                  <input
                    type="text"
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-border-subtle text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase">Join Code (Permanent)</span>
                  <div className="font-mono font-bold text-primary text-sm">{editingClassroom.join_code}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteClassroom(editingClassroom)}
                  className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 font-semibold transition-colors"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={editSaving} className="bg-primary hover:bg-primary/90 text-white">
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- JOIN CLASSROOM MODAL (Portaled to document.body) --- */}
      {mounted && showJoinModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-border-subtle max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 relative my-auto">
            <button
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <h2 className="text-base font-bold text-text-primary mb-1 flex items-center gap-2">
              <Users size={18} className="text-primary" /> Join Classroom with Code
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Enter the unique 8-character join code provided by your Department Head.
            </p>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Classroom Join Code:
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g., CSE-CDW3"
                  className="w-full px-3.5 py-2.5 text-sm font-mono tracking-wider font-bold rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Your Subject:
                  </label>
                  <input
                    type="text"
                    value={assignedSubject}
                    onChange={(e) => setAssignedSubject(e.target.value)}
                    placeholder="e.g., Data Structures"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Assigned Section:
                  </label>
                  <input
                    type="text"
                    value={assignedSection}
                    onChange={(e) => setAssignedSection(e.target.value)}
                    placeholder="e.g., CSE-C"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowJoinModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={joinSaving} className="bg-primary hover:bg-primary/90 text-white">
                  {joinSaving ? 'Joining…' : 'Join Classroom'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- DAILY DIGEST MODAL (Portaled to document.body) --- */}
      {mounted && showDigestModal && selectedClassroom && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-border-subtle max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 relative my-auto max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowDigestModal(false)}
              className="absolute top-4 right-4 p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4 pr-8">
              <div>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-600" /> Daily Compliance Digest
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {selectedClassroom.name} ({selectedClassroom.department})
                </p>
              </div>
            </div>

            {digestLoading ? (
              <div className="p-8 text-center text-text-muted">
                <Sparkles className="animate-spin text-primary mx-auto mb-2" size={20} />
                <p className="text-xs">Compiling faculty submission statuses…</p>
              </div>
            ) : digestData ? (
              <div className="overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/60 text-center">
                    <div className="text-lg font-bold text-blue-700">{digestData.total_faculty}</div>
                    <div className="text-[10px] text-text-muted uppercase font-semibold">Total Faculty</div>
                  </div>
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60 text-center">
                    <div className="text-lg font-bold text-emerald-700">{digestData.reported_today}</div>
                    <div className="text-[10px] text-text-muted uppercase font-semibold">Reported Today</div>
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-center">
                    <div className="text-lg font-bold text-amber-700">{digestData.pending_today}</div>
                    <div className="text-[10px] text-text-muted uppercase font-semibold">Pending Today</div>
                  </div>
                </div>

                <div className="border border-border-subtle rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border-subtle text-text-muted font-semibold">
                        <th className="py-2.5 px-3">Faculty</th>
                        <th className="py-2.5 px-3">Subject / Section</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Topic Covered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {digestData.faculty_statuses.map((f) => (
                        <tr key={f.teacher_id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-text-primary">
                            {f.teacher_name}
                            <div className="text-[10px] text-text-muted font-normal">{f.teacher_email}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            {f.assigned_subject || 'General'}
                            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-semibold">
                              {f.assigned_section}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              f.compliance.reported ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {f.compliance.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-text-muted truncate max-w-xs">
                            {f.compliance.topic || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-border-subtle mt-4">
              <Button variant="outline" size="sm" onClick={() => setShowDigestModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
