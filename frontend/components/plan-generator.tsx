'use client';
import { FormEvent, useEffect, useState, useRef } from 'react';
import {
  Sparkles, Upload, Calendar, BookOpen, CheckCircle2,
  Trash2, Plus, Send, FileSpreadsheet, Layers, ArrowRight,
  FileText, Image as ImageIcon, Check, X, AlertCircle
} from 'lucide-react';
import { api, post } from '@/lib/api';
import { Classroom, User } from '@/types';
import { Button } from '@/components/ui/button';

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
  const [course, setCourse] = useState('Data Structures');
  const [classSection, setClassSection] = useState('CSE-C');
  const [faculty, setFaculty] = useState('Dr. Ramanathan');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewActivities, setPreviewActivities] = useState<GeneratedActivity[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Classroom[]>('/classrooms')
      .then((cls) => {
        setClassrooms(cls);
        if (cls.length > 0) setSelectedClassroomId(cls[0].id);
      })
      .catch((err) => onError(err.message));
  }, []);

  const templates = [
    {
      title: 'Data Structures (CSE-C)',
      dept: 'CSE',
      crs: 'Data Structures and Algorithms',
      sec: 'CSE-C',
      prompt: 'Generate an 8-lecture schedule covering Asymptotic Complexity, Arrays, Singly Linked Lists, Stacks, and Queues with practical lab sessions.',
    },
    {
      title: 'Database Systems (CSE-B)',
      dept: 'CSE',
      crs: 'Database Management Systems',
      sec: 'CSE-B',
      prompt: 'Generate an 8-session plan for Relational Algebra, ER Models, SQL Queries, Normalization up to BCNF, and ACID Transactions.',
    },
    {
      title: 'Operating Systems (CSE-A)',
      dept: 'CSE',
      crs: 'Operating Systems',
      sec: 'CSE-A',
      prompt: 'Generate a 6-session syllabus covering Process Lifecycle, CPU Scheduling Algorithms, Semaphores, and Virtual Memory Paging.',
    },
  ];

  function applyTemplate(t: typeof templates[0]) {
    setDepartment(t.dept);
    setCourse(t.crs);
    setClassSection(t.sec);
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
    const newAct: GeneratedActivity = {
      activity_id: `${department}-${course.slice(0, 3).toUpperCase()}-${classSection.replace('-', '')}-${String(nextIdx).padStart(3, '0')}`,
      semester: '2026 Odd Semester',
      department,
      course,
      unit: `Unit ${Math.ceil(nextIdx / 3)}`,
      activity_name: 'New Lecture Session',
      activity_type: 'Lecture',
      faculty,
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
              AI Syllabus Engine
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 flex items-center gap-1">
              <Sparkles size={11} /> Claude Haiku Vision & OCR
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            AI Timetable OCR & Natural Language Plan Generator
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
            Upload a timetable photo/PDF or describe the desired curriculum. Claude Haiku structures the syllabus and slots it into your classroom group.
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
              className="bg-white hover:bg-blue-50/40 border border-border-subtle hover:border-primary/50 rounded-2xl p-4 transition-all cursor-pointer shadow-2xs hover:shadow-xs group"
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

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Course Name:
              </label>
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g., Data Structures"
                className="w-full rounded-xl border border-border-subtle bg-slate-50/50 px-3.5 py-2.5 text-xs text-text-primary focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium"
                required
              />
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

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Curriculum Start Date:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-slate-50/50 px-3.5 py-2.5 text-xs text-text-primary focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Faculty In-Charge:
              </label>
              <input
                type="text"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="e.g., Dr. Ramanathan"
                className="w-full rounded-xl border border-border-subtle bg-slate-50/50 px-3.5 py-2.5 text-xs text-text-primary focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium"
              />
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
                placeholder="e.g., Generate a 10-session plan for CSE-C starting Monday. Include 6 lectures on Graph Algorithms (BFS, DFS, Dijkstra) and 4 hands-on laboratory sessions."
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

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={generating || (!promptText && !file)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
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
              <Button variant="outline" size="sm" onClick={addEmptyRow} className="rounded-xl text-xs">
                <Plus size={13} /> Add Session
              </Button>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={publishing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
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
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Topic Title</th>
                  <th className="py-2.5 px-3">Type</th>
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
                        className="w-28 px-2 py-1 text-xs font-mono font-bold text-primary rounded-lg border border-border-subtle bg-slate-50 focus:bg-white"
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
