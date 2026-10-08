'use client';
import { FormEvent, useEffect, useState, useRef } from 'react';
import {
  Sparkles, Upload, Calendar, BookOpen, CheckCircle2,
  Trash2, Plus, Send, FileSpreadsheet, Layers, ArrowRight,
  FileText, Image as ImageIcon, Check, X, AlertCircle, RotateCcw,
  Users, UserCheck, ShieldCheck
} from 'lucide-react';
import { api, post } from '@/lib/api';
import { Classroom, User } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type GeneratedActivity = {
  activity_id: string;
  semester: string;
  department: string;
  course: string;
  unit: string;
  activity_name: string;
  activity_type: string;
  faculty: string | null;
  class_section: string;
  planned_start: string;
  planned_end: string;
  level: number;
};

const DRAFT_STORAGE_KEY = 'academicflow_plan_draft_v1';

export function PlanGenerator({
  user,
  onPlanPublished,
  onNotify,
  onError,
}: {
  user: User;
  onPlanPublished: () => void;
  onNotify: (msg: string) => void;
  onError: (err: string) => void;
}) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [promptText, setPromptText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [department, setDepartment] = useState(user.department || 'CSE');
  const [course, setCourse] = useState('ALL');
  const [classSection, setClassSection] = useState('CSE-C');
  const [faculty, setFaculty] = useState('DS: Dr. Ramanathan, DBMS: Prof. Anitha, OS: Dr. Karthik');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewActivities, setPreviewActivities] = useState<GeneratedActivity[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load classrooms
  useEffect(() => {
    api<Classroom[]>('/classrooms')
      .then((cls) => {
        setClassrooms(cls);
        if (cls.length > 0 && !selectedClassroomId) setSelectedClassroomId(cls[0].id);
      })
      .catch((err) => onError(err.message));
  }, []);

  // Restore draft state from localStorage so page navigation does not lose work
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        let hasContent = false;
        if (parsed.promptText) {
          setPromptText(parsed.promptText);
          hasContent = true;
        }
        if (parsed.department) setDepartment(parsed.department);
        if (parsed.course) setCourse(parsed.course);
        if (parsed.classSection) setClassSection(parsed.classSection);
        if (parsed.faculty) setFaculty(parsed.faculty);
        if (parsed.startDate) setStartDate(parsed.startDate);
        if (parsed.selectedClassroomId) setSelectedClassroomId(parsed.selectedClassroomId);
        if (Array.isArray(parsed.previewActivities) && parsed.previewActivities.length > 0) {
          setPreviewActivities(parsed.previewActivities);
          hasContent = true;
        }
        if (hasContent) {
          setDraftRestored(true);
        }
      }
    } catch (e) {
      console.warn('Failed to restore draft plan:', e);
    }
  }, []);

  // Auto-save draft on changes
  useEffect(() => {
    try {
      if (promptText || previewActivities.length > 0 || course !== 'ALL') {
        const draftData = {
          promptText,
          department,
          course,
          classSection,
          faculty,
          startDate,
          selectedClassroomId,
          previewActivities,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
      }
    } catch (e) {
      console.warn('Failed to persist draft plan:', e);
    }
  }, [promptText, department, course, classSection, faculty, startDate, selectedClassroomId, previewActivities]);

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
    setPromptText('');
    setCourse('ALL');
    setClassSection('CSE-C');
    setFaculty('DS: Dr. Ramanathan, DBMS: Prof. Anitha, OS: Dr. Karthik');
    setPreviewActivities([]);
    setFile(null);
    setDraftRestored(false);
    onNotify('Draft cleared. Reset to default state.');
  }

  const templates = [
    {
      title: 'Full Timetable Matrix (All Courses)',
      dept: 'CSE',
      crs: 'ALL',
      sec: 'CSE-C',
      faculty: 'DS: Dr. Ramanathan, DBMS: Prof. Anitha, OS: Dr. Karthik, CN: Dr. Priya',
      prompt: 'Extract all 4 subjects from timetable for section CSE-C. Generate complete 8-session modular plans for Data Structures, Database Systems, Operating Systems, and Networks with practical labs.',
    },
    {
      title: 'Data Structures & Algorithms',
      dept: 'CSE',
      crs: 'Data Structures and Algorithms',
      sec: 'CSE-C',
      faculty: 'Dr. Ramanathan',
      prompt: 'Generate an 8-lecture schedule covering Asymptotic Complexity, Arrays, Singly Linked Lists, Stacks, Queues, and Graph Traversals with lab sessions.',
    },
    {
      title: 'Database Management Systems',
      dept: 'CSE',
      crs: 'Database Management Systems',
      sec: 'CSE-B',
      faculty: 'Prof. Anitha',
      prompt: 'Generate an 8-session plan for Relational Algebra, ER Models, SQL Queries, Normalization up to BCNF, and ACID Transactions.',
    },
  ];

  function applyTemplate(t: typeof templates[0]) {
    setDepartment(t.dept);
    setCourse(t.crs);
    setClassSection(t.sec);
    setFaculty(t.faculty);
    setPromptText(t.prompt);
    onNotify(`Applied starter prompt: ${t.title}`);
  }

  async function handleExtractOrPrompt(e: FormEvent) {
    e.preventDefault();
    if (!promptText && !file) {
      onError('Please provide a prompt instruction or upload a timetable photo/PDF.');
      return;
    }
    setGenerating(true);
    setPreviewActivities([]);
    try {
      const formData = new FormData();
      if (promptText) formData.append('prompt', promptText);
      if (file) formData.append('file', file);
      formData.append('department', department);
      formData.append('course', course);
      formData.append('class_section', classSection);
      if (faculty) formData.append('faculty', faculty);
      if (startDate) formData.append('start_date', startDate);
      if (selectedClassroomId) formData.append('classroom_id', selectedClassroomId);

      const res = await api<any>('/plan/extract-or-prompt', {
        method: 'POST',
        body: formData,
      });

      if (res.activities && res.activities.length > 0) {
        setPreviewActivities(res.activities);
        onNotify(`Generated ${res.activities.length} planned activities! Review before publishing.`);
      } else {
        onError('No activities generated. Please refine your prompt.');
      }
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function updateActivityField(index: number, field: keyof GeneratedActivity, value: string) {
    const updated = [...previewActivities];
    (updated[index] as any)[field] = value;
    setPreviewActivities(updated);
  }

  function removeActivity(index: number) {
    setPreviewActivities(previewActivities.filter((_, i) => i !== index));
  }

  function addEmptyRow() {
    const nextIdx = previewActivities.length + 1;
    const resolvedCourse = course === 'ALL' ? 'Core Course' : course;
    const newAct: GeneratedActivity = {
      activity_id: `${department}-${resolvedCourse.slice(0, 3).toUpperCase()}-${classSection.replace('-', '')}-${String(nextIdx).padStart(3, '0')}`,
      semester: '2026 Odd Semester',
      department,
      course: resolvedCourse,
      unit: `Unit ${Math.ceil(nextIdx / 3)}`,
      activity_name: 'New Lecture Session',
      activity_type: 'Lecture',
      faculty: faculty.includes(':') ? faculty.split(',')[0].split(':')[1]?.trim() || null : faculty || null,
      class_section: classSection,
      planned_start: startDate,
      planned_end: startDate,
      level: 5,
    };
    setPreviewActivities([...previewActivities, newAct]);
  }

  async function handlePublish() {
    if (previewActivities.length === 0) return;
    setPublishing(true);
    try {
      const payload = {
        classroom_id: selectedClassroomId || undefined,
        activities: previewActivities,
      };
      const res = await post<any>('/plan/publish', payload);
      onNotify(`Success! Published ${res.published_count} activities directly into ${selectedClassroomId ? 'Classroom' : 'Master Plan'}!`);
      // Clear persistent draft
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {}
      setDraftRestored(false);
      setPreviewActivities([]);
      setPromptText('');
      setFile(null);
      onPlanPublished();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  const isAllCourses = course === 'ALL' || course.toLowerCase().includes('all');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Draft Restored Banner */}
      {draftRestored && (
        <div className="p-3.5 bg-blue-50/90 border border-blue-200 text-blue-900 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="font-semibold">
              Draft Restored: Your previous prompt and settings were automatically preserved across pages.
            </span>
          </div>
          <button
            type="button"
            onClick={clearDraft}
            className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors flex items-center gap-1 self-start sm:self-auto cursor-pointer active:scale-95 shadow-2xs"
          >
            <RotateCcw size={12} /> Clear Draft
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
              AI Syllabus & Timetable Engine
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 flex items-center gap-1">
              <Sparkles size={11} /> Claude Haiku Vision & OCR
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            AI Timetable OCR & Natural Language Plan Generator
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
            Upload a timetable photo/PDF or describe curriculum requirements. Claude Haiku structures the syllabus, maps faculty handlers, and slots sessions into your classroom group.
          </p>
        </div>
      </div>

      {/* Quick Template Starters */}
      <div>
        <div className="text-[11px] font-bold tracking-wider text-text-muted uppercase mb-3 flex items-center gap-1.5">
          <Sparkles size={13} className="text-primary" /> Quick HOD Prompt Starters:
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((t, idx) => (
            <div
              key={idx}
              onClick={() => applyTemplate(t)}
              className="bg-white hover:bg-blue-50/40 border border-border-subtle hover:border-primary/50 rounded-2xl p-4 transition-all cursor-pointer shadow-2xs hover:shadow-xs group active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs text-text-primary group-hover:text-primary transition-colors">
                  {t.title}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {t.sec}
                </span>
              </div>
              <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                {t.prompt}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Generator Form */}
      <section className="bg-white rounded-2xl border border-border-subtle p-6 md:p-8 shadow-xs">
        <form onSubmit={handleExtractOrPrompt} className="space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Target Classroom Group:
              </label>
              <select
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-slate-50/50 px-3.5 py-2.5 text-xs text-text-primary focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium"
              >
                <option value="">Institution-wide Master Plan (No Group)</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.department} - {c.academic_year})
                  </option>
                ))}
              </select>
            </div>

            {/* Course Scope (Supports ALL courses or specific single course) */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-text-primary">
                  Course Scope:
                </label>
                <button
                  type="button"
                  onClick={() => setCourse(isAllCourses ? 'Data Structures' : 'ALL')}
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer",
                    isAllCourses
                      ? "bg-purple-100 text-purple-700 border-purple-300 shadow-2xs"
                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                  )}
                >
                  {isAllCourses ? '✓ ALL Courses' : '⚡ Extract ALL'}
                </button>
              </div>
              <select
                value={isAllCourses || ['Data Structures', 'Database Management Systems', 'Operating Systems', 'Computer Networks', 'Cloud Computing', 'Artificial Intelligence'].includes(course) ? course : 'CUSTOM'}
                onChange={(e) => {
                  if (e.target.value === 'CUSTOM') {
                    setCourse('');
                  } else {
                    setCourse(e.target.value);
                  }
                }}
                className="w-full rounded-xl border border-border-subtle bg-slate-50/50 px-3.5 py-2.5 text-xs text-text-primary focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium"
              >
                <option value="ALL">✨ ALL Courses (Auto-Extract All Subjects from Timetable / Prompt)</option>
                <option value="Data Structures">Data Structures & Algorithms</option>
                <option value="Database Management Systems">Database Management Systems</option>
                <option value="Operating Systems">Operating Systems</option>
                <option value="Computer Networks">Computer Networks</option>
                <option value="Cloud Computing">Cloud Computing</option>
                <option value="Artificial Intelligence">Artificial Intelligence</option>
                <option value="CUSTOM">Custom Course Name…</option>
              </select>
              {(!isAllCourses && !['Data Structures', 'Database Management Systems', 'Operating Systems', 'Computer Networks', 'Cloud Computing', 'Artificial Intelligence'].includes(course)) && (
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="Type custom course name…"
                  className="mt-1.5 w-full rounded-xl border border-primary/50 bg-white px-3.5 py-2 text-xs text-text-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Class Section:
              </label>
              <input
                type="text"
                value={classSection}
                onChange={(e) => setClassSection(e.target.value)}
                placeholder="e.g., CSE-C"
                className="w-full rounded-xl border border-border-subtle bg-slate-50/50 px-3.5 py-2.5 text-xs text-text-primary focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Department:
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-slate-50/50 px-3.5 py-2.5 text-xs text-text-primary focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium"
                required
              />
            </div>

            {/* Teacher Assignment & Subject Handlers */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Teacher Assignment & Subject Handlers:
              </label>
              <input
                type="text"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="e.g. DS: Dr. Ramanathan, DBMS: Prof. Anitha, OS: Dr. Karthik"
                className="w-full rounded-xl border border-border-subtle bg-slate-50/50 px-3.5 py-2.5 text-xs text-text-primary focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium"
              />
              <p className="text-[10px] text-text-muted mt-1">
                Enter teacher mappings or faculty in-charge. Claude will assign each subject session to the appropriate instructor.
              </p>
            </div>
          </div>

          {/* Prompt & File Upload Inputs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Natural Language Syllabus Instructions:
              </label>
              <textarea
                rows={5}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder={isAllCourses ? "e.g., Extract all subjects from timetable matrix. For DSA, cover linked lists, trees, graphs; for DBMS, cover SQL, normalization, transactions; for OS, cover paging, scheduling, semaphores." : "e.g., Generate a 10-session plan for CSE-C starting Monday. Include 6 lectures on Graph Algorithms (BFS, DFS, Dijkstra) and 4 hands-on laboratory sessions."}
                className="w-full rounded-xl border border-border-subtle bg-slate-50/50 p-3.5 text-xs text-text-primary placeholder:text-text-muted focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Upload Timetable Photo or Syllabus PDF:
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border-subtle hover:border-primary/60 bg-slate-50/50 hover:bg-blue-50/30 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[126px]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {file ? (
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-border-subtle shadow-2xs">
                    <FileText size={16} className="text-primary shrink-0" />
                    <span className="text-xs font-semibold text-text-primary truncate max-w-xs">{file.name}</span>
                    <span className="text-[10px] text-text-muted font-mono">({Math.round(file.size / 1024)} KB)</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="p-1 hover:text-danger text-text-muted"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={22} className="text-primary mb-2" />
                    <p className="text-xs font-semibold text-text-primary">
                      Click to browse or drop timetable photo/PDF
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Supports PNG, JPG, or PDF (Claude Haiku OCR automated)
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Animated Generation Banner */}
          {generating && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-indigo-200/80 p-6 shadow-xs animate-in fade-in duration-300 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs">
                    <Sparkles size={20} className="animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">
                      Claude Haiku AI Generating Academic Plan…
                    </h3>
                    <p className="text-xs text-text-muted">
                      {isAllCourses ? 'Extracting all timetable courses, slots & instructors' : `Structuring syllabus for ${course}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700 shadow-2xs animate-pulse">
                    Processing
                  </span>
                </div>
              </div>

              {/* Multi-step progression indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                <div className="bg-white/90 rounded-xl p-2.5 border border-indigo-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[11px] font-medium text-slate-700">1. Prompt & OCR Ingestion</span>
                </div>
                <div className="bg-white/90 rounded-xl p-2.5 border border-indigo-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-[11px] font-medium text-slate-700">2. Claude Haiku Vision</span>
                </div>
                <div className="bg-white/90 rounded-xl p-2.5 border border-indigo-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                  <span className="text-[11px] font-medium text-slate-700">3. Faculty Handlers Map</span>
                </div>
                <div className="bg-white/90 rounded-xl p-2.5 border border-indigo-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[11px] font-medium text-slate-700">4. Bloom&apos;s Taxonomy & Dates</span>
                </div>
              </div>

              {/* Progress shimmer bar */}
              <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-2 rounded-full animate-pulse w-4/5" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={generating || (!promptText && !file)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {generating ? (
                <>
                  <Sparkles size={15} className="animate-spin" />
                  Generating Structured Plan with Claude…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Generate Academic Plan
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Generated Preview Table */}
      {previewActivities.length > 0 && (
        <section className="bg-white rounded-2xl border border-border-subtle p-6 shadow-xs animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border-subtle mb-4 gap-3">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" /> Generated Plan Preview
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Review, modify, or add sessions before committing to the institutional Master Excel.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={addEmptyRow} className="rounded-xl text-xs active:scale-[0.98]">
                <Plus size={13} /> Add Session
              </Button>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={publishing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs active:scale-[0.98]"
              >
                {publishing ? 'Publishing…' : 'Publish to Master Plan & Sync Excel'}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-border-subtle text-text-muted font-semibold">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Topic Title</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Teacher / Handler</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {previewActivities.map((act, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={act.activity_id}
                        onChange={(e) => updateActivityField(idx, 'activity_id', e.target.value)}
                        className="w-24 px-2 py-1 text-xs font-mono font-bold text-primary rounded-lg border border-border-subtle bg-slate-50 focus:bg-white"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={act.course}
                        onChange={(e) => updateActivityField(idx, 'course', e.target.value)}
                        className="w-32 px-2 py-1 text-xs font-semibold rounded-lg border border-border-subtle bg-slate-50 focus:bg-white"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={act.unit}
                        onChange={(e) => updateActivityField(idx, 'unit', e.target.value)}
                        className="w-20 px-2 py-1 text-xs rounded-lg border border-border-subtle bg-slate-50 focus:bg-white"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={act.activity_name}
                        onChange={(e) => updateActivityField(idx, 'activity_name', e.target.value)}
                        className="w-full min-w-[200px] px-2 py-1 text-xs font-medium rounded-lg border border-border-subtle bg-slate-50 focus:bg-white"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={act.activity_type}
                        onChange={(e) => updateActivityField(idx, 'activity_type', e.target.value)}
                        className="px-2 py-1 text-xs rounded-lg border border-border-subtle bg-slate-50 focus:bg-white"
                      >
                        <option value="Lecture">Lecture</option>
                        <option value="Lab">Lab</option>
                        <option value="Tutorial">Tutorial</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={act.faculty || ''}
                        onChange={(e) => updateActivityField(idx, 'faculty', e.target.value)}
                        placeholder="Assign teacher"
                        className="w-28 px-2 py-1 text-xs rounded-lg border border-border-subtle bg-slate-50 focus:bg-white"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={act.class_section}
                        onChange={(e) => updateActivityField(idx, 'class_section', e.target.value)}
                        className="w-16 px-2 py-1 text-xs rounded-lg border border-border-subtle bg-slate-50 focus:bg-white"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        value={act.planned_start}
                        onChange={(e) => updateActivityField(idx, 'planned_start', e.target.value)}
                        className="px-2 py-1 text-xs rounded-lg border border-border-subtle bg-slate-50 focus:bg-white"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => removeActivity(idx)}
                        className="p-1 text-text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remove session"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
