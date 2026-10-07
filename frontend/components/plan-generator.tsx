'use client';
import { FormEvent, useEffect, useState } from 'react';
import {
  Sparkles,
  Upload,
  Calendar,
  BookOpen,
  CheckCircle2,
  Trash2,
  Plus,
  Send,
  FileSpreadsheet,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { api, post } from '@/lib/api';
import { Classroom, User } from '@/types';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
          AI Timetable OCR & Natural Language Plan Generator
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
          Upload a timetable photo/PDF or describe the desired curriculum. Claude Haiku structures the syllabus and slots it into your classroom group.
        </p>
      </div>

      {/* Quick Template Cards */}
      <div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Quick HOD Prompt Starters:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 8 }}>
          {templates.map((t, idx) => (
            <div
              key={idx}
              onClick={() => applyTemplate(t)}
              style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
            >
              <div style={{ fontWeight: 600, fontSize: 12, color: '#1e293b', marginBottom: 4 }}>
                {t.title}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                {t.prompt.slice(0, 95)}…
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Form Panel */}
      <section className="panel" style={{ padding: 24 }}>
        <form onSubmit={handleExtractOrPrompt}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <label>
              Target Classroom Group
              <select
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
              >
                <option value="">Institution-wide Master Plan (No Group)</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.join_code})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Course Name
              <input
                type="text"
                required
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. Data Structures"
              />
            </label>

            <label>
              Class Section
              <input
                type="text"
                required
                value={classSection}
                onChange={(e) => setClassSection(e.target.value)}
                placeholder="e.g. CSE-C"
              />
            </label>

            <label>
              Faculty In-Charge
              <input
                type="text"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="e.g. Dr. Ramanathan"
              />
            </label>

            <label>
              Curriculum Start Date
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 16 }}>
            {/* Natural language prompter */}
            <label>
              Natural Language Syllabus Instructions
              <textarea
                rows={4}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="e.g., Create a 10-session plan for CSE-C starting Monday. Include 6 lectures on Singly/Doubly Linked Lists and 4 hands-on laboratory exercises."
              />
            </label>

            {/* Timetable / PDF File Upload */}
            <div className="upload-area" style={{ height: 'auto', minHeight: 120 }}>
              <Upload size={24} color="#2563eb" />
              <strong>Upload Timetable Photo or Syllabus PDF</strong>
              <p style={{ margin: 0 }}>PNG, JPG, or PDF (OCR automated)</p>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Selected: {file.name}</span>}
            </div>
          </div>

          <div className="actions" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="primary"
              disabled={generating || (!promptText.trim() && !file)}
            >
              <Sparkles size={16} />
              {generating ? 'Analyzing Timetable & Generating…' : 'Generate Academic Plan'}
            </button>
          </div>
        </form>
      </section>

      {/* Generated Preview Grid */}
      {previewActivities.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color="#16a34a" /> Plan Preview ({previewActivities.length} Sessions)
              </h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 11 }}>
                Review, edit, or add sessions below. Clicking "Publish" permanently commits these rows into the classroom and embeds them for semantic AI matching.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="secondary" onClick={addEmptyRow} style={{ padding: '6px 10px', fontSize: 11 }}>
                <Plus size={14} /> Add Row
              </button>
              <button
                type="button"
                className="primary"
                onClick={handlePublish}
                disabled={publishing}
                style={{ padding: '6px 14px', fontSize: 11 }}
              >
                <ArrowRight size={14} /> {publishing ? 'Publishing…' : 'Publish Plan to Classroom'}
              </button>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Activity ID</th>
                  <th>Unit</th>
                  <th>Topic Description</th>
                  <th>Type</th>
                  <th>Section</th>
                  <th>Planned Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {previewActivities.map((act, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        style={{ padding: '4px 6px', fontSize: 11, width: 130 }}
                        value={act.activity_id}
                        onChange={(e) => updateActivityField(idx, 'activity_id', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        style={{ padding: '4px 6px', fontSize: 11, width: 140 }}
                        value={act.unit}
                        onChange={(e) => updateActivityField(idx, 'unit', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        style={{ padding: '4px 6px', fontSize: 11, width: '100%', minWidth: 200 }}
                        value={act.activity_name}
                        onChange={(e) => updateActivityField(idx, 'activity_name', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        style={{ padding: '4px 6px', fontSize: 11 }}
                        value={act.activity_type}
                        onChange={(e) => updateActivityField(idx, 'activity_type', e.target.value)}
                      >
                        <option value="Lecture">Lecture</option>
                        <option value="Practical">Practical</option>
                        <option value="Tutorial">Tutorial</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        style={{ padding: '4px 6px', fontSize: 11, width: 70 }}
                        value={act.class_section}
                        onChange={(e) => updateActivityField(idx, 'class_section', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        style={{ padding: '4px 6px', fontSize: 11 }}
                        value={act.planned_start}
                        onChange={(e) => {
                          updateActivityField(idx, 'planned_start', e.target.value);
                          updateActivityField(idx, 'planned_end', e.target.value);
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => removeActivity(idx)}
                        title="Remove session"
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={14} />
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
