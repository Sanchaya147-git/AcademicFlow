'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Activity as Pulse, ArrowRight, BookOpen, CheckCircle2, ClipboardList, Clock3, FileText, GraduationCap, LayoutDashboard, LogOut, RefreshCw, SearchCheck, ShieldCheck, Upload, BarChart3, CalendarDays, CircleHelp, Bell, PhoneCall, Sparkles, Users } from 'lucide-react';
import { api, post } from '@/lib/api';
import { Activity, Analytics, Audit, Candidate, Event as ExecutionEvent, Report, ReviewItem, User } from '@/types';
import { ActivityTable } from './activity-table';
import { Charts } from './analytics-charts';
import { ClassroomHub } from './classroom-hub';
import { PlanGenerator } from './plan-generator';

const links = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['classrooms', 'Classrooms & Hub', Users],
  ['plan-generator', 'AI Plan Prompter', Sparkles],
  ['reports', 'Reports', FileText],
  ['review', 'Review queue', SearchCheck],
  ['unmatched', 'Unmatched', CircleHelp],
  ['activities', 'Academic plan', BookOpen],
  ['schedule', 'Schedule', CalendarDays],
  ['analytics', 'Analytics', BarChart3],
  ['audit', 'Audit trail', ShieldCheck],
] as const;
const titles: Record<string, [string, string]> = {
  dashboard: ['Execution overview', 'A clear view of what was planned, reported, and delivered.'],
  classrooms: ['Classrooms & Collaboration Hub', 'Manage department groups, join codes, and teacher subject enrollments.'],
  'plan-generator': ['AI Timetable & Plan Generator', 'Extract academic schedules from timetable images, PDFs, or natural language prompts.'],
  reports: ['Faculty reports', 'Capture academic execution from natural language or spreadsheets.'],
  review: ['Human review queue', 'Your academic context. AI-assisted recommendations. Your decision.'],
  unmatched: ['Unmatched activities', 'Every report matters — nothing is silently discarded.'],
  activities: ['Master academic plan', 'The institutional plan, connected to source-backed execution.'],
  schedule: ['Academic schedule', 'Compare planned dates with verified actual execution.'],
  analytics: ['Institutional intelligence', 'Evidence-based progress, with transparent sample sizes.'],
  audit: ['Trust & audit trail', 'Trace every decision back to its source and responsible actor.'],
};

type Resolution = { item: ReviewItem; kind: 'approve' | 'reject' | 'map' | 'classify'; candidate?: Candidate; classification?: string };

export function Workspace({ section = 'dashboard', activityId }: { section?: string; activityId?: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [provider, setProvider] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [detail, setDetail] = useState<{ activity: Activity; executions: ReviewItem[]; audit: Audit[] } | null>(null);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [reason, setReason] = useState('');
  const [selection, setSelection] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState('');
  const [classSection, setClassSection] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [pipeline, setPipeline] = useState<{ event_id: string; decision: string; candidates: Candidate[] }[]>([]);
  const [showCallModal, setShowCallModal] = useState(false);
  const [simMode, setSimMode] = useState<'simulate' | 'phone'>('simulate');
  const [callPhone, setCallPhone] = useState('+916380221196');
  const [simLoading, setSimLoading] = useState(false);
  const [callLoading, setCallLoading] = useState(false);
  const [callResult, setCallResult] = useState<{ status: string; call_sid?: string; to?: string } | null>(null);

  const [chatSessionId, setChatSessionId] = useState('sim_session_1');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'ai' | 'user'; text: string; tamil?: string }>>([
    {
      sender: 'ai',
      text: 'Welcome Professor! Please tell what you covered in class today in English, Tamil, or Tanglish.',
      tamil: 'வணக்கம் புரொபசர். அகாடமிக் ஃப்ளோவிற்கு வரவேற்கிறோம். இன்று வகுப்பில் என்ன நடத்தினீர்கள் என்று கூறுங்கள்.',
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatComplete, setChatComplete] = useState(false);
  const [chatMatchResult, setChatMatchResult] = useState<any>(null);

  function startNewConversation() {
    setChatSessionId('sim_' + Math.random().toString(36).substring(2, 9));
    setChatHistory([
      {
        sender: 'ai',
        text: 'Welcome Professor! Please tell what you covered in class today in English, Tamil, or Tanglish.',
        tamil: 'வணக்கம் புரொபசர். அகாடமிக் ஃப்ளோவிற்கு வரவேற்கிறோம். இன்று வகுப்பில் என்ன நடத்தினீர்கள் என்று கூறுங்கள்.',
      }
    ]);
    setChatComplete(false);
    setChatMatchResult(null);
    setChatInput('');
  }

  async function sendChatTurn(customText?: string) {
    const text = (customText || chatInput).trim();
    if (!text || simLoading) return;
    setSimLoading(true); setError('');
    const newHistory = [...chatHistory, { sender: 'user' as const, text }];
    setChatHistory(newHistory);
    setChatInput('');
    try {
      const res = await post<any>('/webhook/voice/chat', { session_id: chatSessionId, speech_text: text });
      setChatHistory([
        ...newHistory,
        {
          sender: 'ai',
          text: res.speech_reply_english,
          tamil: res.speech_reply_tamil,
        }
      ]);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(res.speech_reply_english);
        window.speechSynthesis.speak(utterance);
      }
      if (res.is_complete) {
        setChatComplete(true);
        setChatMatchResult(res.match_result);
        setNotice('Conversation complete! Grounded in syllabus and synchronized to Master Plan.');
        await refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSimLoading(false);
    }
  }

  async function handleTriggerPhoneCall() {
    setCallLoading(true); setError(''); setCallResult(null);
    try {
      const res = await post<any>(`/webhook/voice/call?to_phone=${encodeURIComponent(callPhone)}`);
      setCallResult(res);
      setNotice(`Calling ${callPhone} via Twilio! Answer phone to speak.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCallLoading(false);
    }
  }

  useEffect(() => {
    api<User>('/auth/me').then(setUser).catch(e => { if (!String(e.message).startsWith('401')) setError(e.message); }).finally(() => setBooting(false));
    api<{ provider: string }>('/health').then(v => setProvider(v.provider)).catch(() => {});
  }, []);

  const [revision, setRevision] = useState(0);
  const refresh = useCallback(async () => { setRevision(value => value + 1); }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const request = activityId ? api(`/activities/${activityId}`)
      : section === 'dashboard' || section === 'analytics' ? api('/analytics/overview')
      : section === 'activities' || section === 'schedule' ? api('/activities')
      : section === 'reports' ? api('/reports')
      : section === 'review' || section === 'unmatched'
        ? Promise.all([api(section === 'review' ? '/review/queue' : '/review/unmatched'), api('/activities')])
      : section === 'classrooms' || section === 'plan-generator'
        ? Promise.resolve(null)
      : api('/audit');
    request.then(value => {
      if (!active) return;
      if (activityId) setDetail(value as { activity: Activity; executions: ReviewItem[]; audit: Audit[] });
      else if (section === 'dashboard' || section === 'analytics') setAnalytics(value as Analytics);
      else if (section === 'activities' || section === 'schedule') setActivities(value as Activity[]);
      else if (section === 'reports') setReports(value as Report[]);
      else if (section === 'review' || section === 'unmatched') {
        const [items, plan] = value as [ReviewItem[], Activity[]]; setQueue(items); setActivities(plan);
      } else if (section === 'classrooms' || section === 'plan-generator') {
        /* Self-managed */
      } else setAudit(value as Audit[]);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, section, activityId, revision]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try { const response = await post<{ user: User }>('/auth/login', { email: data.get('email'), password: data.get('password') }); setUser(response.user); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function processReport(reportId: string) {
    setNotice('Report preserved. Extracting structured evidence…');
    const events = await post<ExecutionEvent[]>(`/extraction/${reportId}`);
    const outcomes = [];
    for (const event of events) {
      setNotice(`Matching event ${outcomes.length + 1} of ${events.length}…`);
      outcomes.push(await post<{ event_id: string; decision: string; candidates: Candidate[] }>(`/matching/${event.id}`));
    }
    setPipeline(outcomes);
    setNotice(`Processed ${events.length} event(s). Review the source-backed decisions below.`);
  }
  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    setBusy(true); setError(''); setPipeline([]);
    const data = new FormData(form);
    try {
      const result = await post<{ report_id: string }>('/reports/text', { content: data.get('content') });
      await processReport(result.report_id); form.reset(); await refresh();
    } catch (e) { setError((e as Error).message); setNotice('If ingestion succeeded, the original report remains saved. Retry processing from its report row.'); await refresh(); }
    finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setPipeline([]);
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<{ report_id: string; processed_rows: number; failed_rows: number; errors: unknown[] }>('/reports/spreadsheet', { method: 'POST', body: data });
      setNotice(`${result.processed_rows} valid rows, ${result.failed_rows} failed rows. Details are preserved on the report.`);
      await processReport(result.report_id); await refresh();
      setNotice(`${result.processed_rows} rows processed; ${result.failed_rows} failed rows. ${result.errors.length ? JSON.stringify(result.errors) : 'No row errors.'}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function resume(reportId: string) {
    setBusy(true); setError('');
    try { await processReport(reportId); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function openResolution(value: Resolution) { setResolution(value); setReason(''); setSelection(''); setSearch(''); }
  async function confirm(event: FormEvent) {
    event.preventDefault(); if (!resolution) return;
    setBusy(true); setError('');
    try {
      const { item, candidate, kind, classification } = resolution;
      if (kind === 'map') await post(`/review/${item.event.id}/manual-map`, { activity_id: selection, reason });
      else if (kind === 'classify') await post(`/review/${item.event.id}/classify`, { classification, reason });
      else await post(`/review/${candidate?.id}/${kind}`, { reason });
      setResolution(null); setNotice('Decision recorded. Schedule and audit history are synchronized.'); await refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const reviewer = user && ['ADMIN', 'COORDINATOR', 'HOD'].includes(user.role);
  const submitter = user && user.role !== 'HOD';
  const filtered = activities.filter(a => (!department || a.department === department) && (!course || a.course === course) && (!status || a.status === status) && (!classSection || a.class_section === classSection) && (!planDate || (a.planned_start <= planDate && a.planned_end >= planDate)));

  if (booting) return <div className="login-page"><p role="status">Connecting to AcademicFlow…</p></div>;
  if (!user) return <div className="login-page"><div className="login-card"><div className="brand-mark"><GraduationCap size={28} /></div><h1>AcademicFlow</h1><p>Academic execution, connected.</p><form onSubmit={authenticate}><label>Email<input name="email" type="email" required autoComplete="username" placeholder="Your institutional email" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label><button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}<ArrowRight size={17} /></button></form>{error && <p className="error" role="alert">{error}</p>}<small>Use the administrator account configured during seed setup. No default password.</small></div></div>;

  return <div className="workspace"><aside className="sidebar"><Link href="/dashboard" className="brand"><div className="brand-mark"><GraduationCap size={23} /></div><div>AcademicFlow<small>EXECUTION INTELLIGENCE</small></div></Link><div className="institution"><span className="institution-icon">AF</span><div>Academic workspace<small>{user.department || 'Institution-wide access'}</small></div></div><p className="nav-label">WORKSPACE</p><nav>{links.filter(([key]) => (!['review','unmatched'].includes(key) || ['ADMIN','COORDINATOR','HOD'].includes(user.role)) && (key !== 'plan-generator' || ['ADMIN','HOD','COORDINATOR'].includes(user.role))).map(([key, label, Icon]) => <Link key={key} href={`/${key}`} className={section === key ? 'active' : ''}><Icon size={18} />{label}{key === 'review' && analytics?.summary.needs_review ? <span className="nav-count">{analytics.summary.needs_review}</span> : null}</Link>)}</nav><div className="trust-card"><ShieldCheck size={20} /><strong>Human judgment matters</strong><p>AI-assisted — review when uncertain. Every decision retains its evidence.</p></div><div className="sidebar-footer"><span className="status-dot" /> Local MVP · {provider === 'demo' ? 'Offline demo provider' : 'OpenAI provider'}</div></aside>
    <div className="main-shell"><header className="topbar"><span>Workspace <span className="muted">/ {activityId ? 'Activity detail' : titles[section]?.[0]}</span></span><div className="header-right"><span className="role-pill">{user.role.replaceAll('_',' ')}</span><Bell size={17} aria-label="Notifications appear in the status area" /><span className="avatar">{user.name.slice(0,2).toUpperCase()}</span><button className="icon-button" aria-label="Sign out" onClick={async () => { try { await post('/auth/logout'); setUser(null); setAnalytics(null); setReports([]); setQueue([]); setAudit([]); setActivities([]); setDetail(null); setNotice(''); setPipeline([]); } catch(e) { setError((e as Error).message); } }}><LogOut size={17} /></button></div></header>
    <main className="content"><div className="page-heading"><div><div className="eyebrow">ACADEMIC INTELLIGENCE</div><h1>{activityId ? detail?.activity.activity_name || 'Activity details' : titles[section]?.[0]}</h1><p>{activityId ? 'Plan, execution evidence, and decision history in one place.' : titles[section]?.[1]}</p></div><div className="heading-actions"><button className="secondary" onClick={() => { setShowCallModal(true); startNewConversation(); setCallResult(null); }}><PhoneCall size={15} /> Simulate Call</button><button className="secondary" onClick={refresh} disabled={loading || busy}><RefreshCw size={15} /> Refresh</button>{section === 'dashboard' && submitter && <Link className="primary" href="/reports"><Upload size={16} /> Submit report</Link>}</div></div>
    {provider === 'demo' && <div className="demo-banner"><CircleHelp size={16} /> Offline demonstration mode: deterministic extraction and lexical vectors, not live semantic AI.</div>}
    {notice && <div className="notice" role="status"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
    {error && <div className="error" role="alert">{error} <button onClick={refresh}>Retry loading</button></div>}
    {loading && <p className="loading" role="status">Loading live academic data…</p>}

    {!activityId && (section === 'dashboard' || section === 'analytics') && analytics && <>
      {analytics.demonstration_data && <p className="data-label">SYNTHETIC MASTER PLAN · Execution values below come from submitted reports, not fabricated history.</p>}
      <div className="metric-grid">{Object.entries(analytics.summary).map(([key, value], index) => <div className="metric" key={key}><div className="metric-top"><span>{key.replaceAll('_',' ')}</span>{index === 0 ? <FileText size={17} /> : index === 1 ? <CheckCircle2 size={17} /> : index === 2 ? <Clock3 size={17} /> : <Pulse size={17} />}</div><strong>{value === null ? '—' : value}{key === 'schedule_health' && value !== null ? '%' : ''}</strong><small>{key === 'schedule_health' ? 'Non-overdue share of planned activities' : 'From accessible institutional records'}</small></div>)}</div>
      <Charts data={analytics} full={section === 'analytics'} />
      {section === 'dashboard' && <div className="bottom-grid"><section className="panel"><div className="panel-heading"><h2>Department progress</h2><Link href="/analytics">View analytics →</Link></div><div className="department-list">{analytics.departments.map(d => <div key={d.name}><div><strong>{d.name}</strong><span>{d.completed} / {d.planned} completed</span><b>{d.progress}%</b></div><progress max={100} value={d.progress} /></div>)}</div></section><section className="panel next-step"><ShieldCheck size={26} /><h2>Transparent by design</h2><p>Source reports are preserved. Missing evidence stays missing. Uncertain matches require a person, not a guess.</p><Link href="/audit">Explore the audit trail <ArrowRight size={16} /></Link></section></div>}
      {section === 'analytics' && <><div className="metric-grid small-metrics">{[['Planned executable sessions', analytics.planned_sessions], ['Actual linked sessions', analytics.actual_sessions], ['Mean duration (minutes)', analytics.average_actual_duration_minutes ?? 'No observations'], ['Duration sample size', analytics.duration_sample_size]].map(([key,value]) => <div className="metric" key={String(key)}><span>{key}</span><strong>{value}</strong></div>)}</div><section className="panel"><div className="panel-heading"><h2>Historical activity observations</h2></div><p className="panel-note">Cross-semester averages are not fabricated. Repeated comparable cohorts are required before presenting a historical average.</p><div className="table-scroll"><table><thead><tr><th>Activity</th><th>Planned sessions</th><th>Observed sessions</th><th>Sample size</th><th>Historical mean</th></tr></thead><tbody>{analytics.historical_activity.map(a => <tr key={a.activity_id}><td>{a.name}</td><td>{a.planned_sessions ?? '—'}</td><td>{a.actual_sessions}</td><td>{a.sample_size}</td><td>Insufficient cohorts</td></tr>)}</tbody></table></div></section></>}
    </>}

    {!activityId && (section === 'activities' || section === 'schedule') && <><div className="filters"><select aria-label="Department" value={department} onChange={e => setDepartment(e.target.value)}><option value="">All departments</option>{[...new Set(activities.map(a => a.department))].map(v => <option key={v}>{v}</option>)}</select><select aria-label="Course" value={course} onChange={e => setCourse(e.target.value)}><option value="">All courses</option>{[...new Set(activities.map(a => a.course))].map(v => <option key={v}>{v}</option>)}</select><select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'].map(v => <option key={v}>{v}</option>)}</select><select aria-label="Class section" value={classSection} onChange={e => setClassSection(e.target.value)}><option value="">All classes</option>{[...new Set(activities.map(a => a.class_section))].map(v => <option key={v}>{v}</option>)}</select><input aria-label="Planned date" type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} /></div><ActivityTable data={filtered} schedule={section === 'schedule'} />{user.role === 'ADMIN' && <button className="secondary" disabled={busy} onClick={async () => { if (!window.confirm('Generate embeddings for the full plan? Live OpenAI mode may incur API charges.')) return; setBusy(true); try { const result = await post<{ indexed: number }>('/activities/reindex'); setNotice(`Indexed ${result.indexed} activities.`); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }}>Generate / refresh plan embeddings</button>}</>}

    {section === 'reports' && <>{submitter && <div className="input-grid"><section className="panel"><div className="panel-heading"><h2><FileText size={18} /> Free-text report</h2></div><form className="report-form" onSubmit={submitReport}><label>What academic activity did you complete?<textarea name="content" required minLength={3} maxLength={20000} rows={5} placeholder="Completed DBMS normalization for CSE-C today. Include course, class, and dates when known." /></label><p className="muted">Submitting as {user.email}. Only source-supported information is extracted.</p><button className="primary" disabled={busy}><ArrowRight size={16} />{busy ? 'Processing…' : 'Submit & process report'}</button></form></section><section className="panel"><div className="panel-heading"><h2><Upload size={18} /> Spreadsheet ingestion</h2></div><form className="report-form" onSubmit={upload}><div className="upload-area"><Upload size={28} /><strong>Upload faculty execution reports</strong><p>.xlsx only · up to 5 MB · 5,000 rows</p><input name="file" type="file" accept=".xlsx" required aria-label="Excel workbook" /></div><p className="muted">Varying column names, row errors, and source evidence are preserved.</p><button className="secondary" disabled={busy}>Upload & process</button></form></section></div>}
      {pipeline.length > 0 && <section className="panel"><div className="panel-heading"><h2>Processing results</h2></div><div className="results">{pipeline.map(p => <div key={p.event_id}><span className={`badge ${p.decision.toLowerCase()}`}>{p.decision}</span>{p.candidates.slice(0,3).map(c => <CandidateCard key={c.id} candidate={c} />)}</div>)}</div></section>}
      <section className="panel"><div className="panel-heading"><h2>Report history</h2><span>{reports.length} reports loaded</span></div>{!reports.length ? <Empty text="No reports yet. Submit the first faculty report above." /> : <div className="report-list">{reports.map(r => <details key={r.id}><summary><FileText size={18} /><strong>{r.report_id}</strong><span className="badge">{r.source_type}</span><span>{new Date(r.submitted_at).toLocaleString()}</span><span>{r.events.length} events</span></summary><div className="report-detail"><pre>{r.raw_content}</pre><div className="event-tags">{r.events.map(e => <span className="badge" key={e.id}>{e.disposition}</span>)}</div>{r.file_metadata && <pre>{JSON.stringify(r.file_metadata,null,2)}</pre>}{submitter && <button className="secondary" disabled={busy} onClick={() => resume(r.report_id)}>Process / retry safely</button>}</div></details>)}</div>}</section></>}

    {(section === 'review' || section === 'unmatched') && <>{!queue.length && !loading ? <Empty text={section === 'review' ? 'All caught up. No events need human review.' : 'No unmatched activities in your scope.'} /> : queue.map(item => <section className="panel review-card" key={item.event.id}><div className="panel-heading"><div><h2>{item.event.activity_description || 'Unspecified activity'}</h2><p>{item.report.report_id} · {item.event.event_date || 'Date not supplied'}</p></div><span className={`badge ${item.event.disposition.toLowerCase()}`}>{item.event.disposition}</span></div><div className="review-columns"><div><h3>01 · Original evidence</h3><blockquote>{item.event.source_excerpt || item.report.raw_content}</blockquote><small>Preserved source text. Never rewritten by matching.</small></div><div><h3>02 · Extracted event</h3><dl>{(['course','department','unit','class_section','faculty','event_date','status'] as const).map(key => <div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{item.event[key] || 'Not provided'}</dd></div>)}</dl></div><div><h3>03 · Candidate activities</h3>{item.candidates.map(c => <CandidateCard key={c.id} candidate={c}>{reviewer && c.decision_type === 'PENDING' && <div className="actions"><button className="primary" disabled={busy} onClick={() => openResolution({ item, candidate: c, kind: 'approve' })}>Approve</button><button className="secondary" disabled={busy} onClick={() => openResolution({ item, candidate: c, kind: 'reject' })}>Reject</button></div>}</CandidateCard>)}</div></div>{reviewer && <div className="review-footer"><button className="secondary" onClick={() => openResolution({ item, kind: 'map' })}>Manually map activity</button>{section === 'unmatched' && [['EXTRA_ACTIVITY','Add as extra activity'],['OUTSIDE_ACADEMIC_SCOPE','Outside academic scope'],['REJECTED','Reject']].map(([classification,label]) => <button className="secondary" key={classification} onClick={() => openResolution({ item, kind: 'classify', classification })}>{label}</button>)}<small>AI-assisted — review when uncertain</small></div>}</section>)}</>}

    {section === 'classrooms' && user && (
      <ClassroomHub
        user={user}
        onOpenVoiceCall={() => { setShowCallModal(true); startNewConversation(); setCallResult(null); }}
        onNotify={setNotice}
        onError={setError}
      />
    )}

    {section === 'plan-generator' && user && (
      <PlanGenerator
        user={user}
        onPlanPublished={() => { refresh(); setNotice('Academic plan successfully published!'); }}
        onNotify={setNotice}
        onError={setError}
      />
    )}

    {activityId && detail && <><section className="panel detail-panel"><div className="panel-heading"><h2>{detail.activity.activity_id}</h2><span className={`badge ${detail.activity.status.toLowerCase()}`}>{detail.activity.status}</span></div><dl>{Object.entries(detail.activity).filter(([key]) => !['id','activity_id','is_demo'].includes(key)).map(([key,value]) => <div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{String(value ?? 'Not supplied')}</dd></div>)}</dl></section><section className="panel"><div className="panel-heading"><h2>Linked execution evidence</h2></div>{detail.executions.length ? detail.executions.map(item => <div className="execution" key={item.event.id}><blockquote>{item.event.source_excerpt}</blockquote><p>{item.report.report_id} · {item.event.event_date || 'No source date'}</p>{item.candidates.filter(c => ['AUTO_LINKED','HUMAN_CONFIRMED','MANUALLY_MAPPED'].includes(c.decision_type)).map(c => <CandidateCard key={c.id} candidate={c} />)}</div>) : <Empty text="No confirmed executions yet." />}</section><AuditTimeline entries={detail.audit} /></>}
    {section === 'audit' && <AuditTimeline entries={audit} />}
    <footer className="content-footer"><span>AcademicFlow · Execution intelligence, not faculty evaluation.</span><span><ShieldCheck size={14} /> Evidence preserved · Humans in control</span></footer>
    </main></div>
    {resolution && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="resolution-title"><h2 id="resolution-title">Confirm {resolution.kind === 'map' ? 'manual mapping' : resolution.classification?.replaceAll('_',' ').toLowerCase() || resolution.kind}</h2><p>This decision will be recorded with your identity and reason. Approving or mapping updates the official execution record.</p><form onSubmit={confirm}>{resolution.kind === 'map' && <><label>Search master activities<input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Activity, course, or class" /></label><label>Select activity<select required value={selection} onChange={e => setSelection(e.target.value)}><option value="">Choose an activity</option>{activities.filter(a => `${a.activity_name} ${a.course} ${a.class_section}`.toLowerCase().includes(search.toLowerCase())).map(a => <option key={a.id} value={a.id}>{a.activity_name} · {a.course} · {a.class_section}</option>)}</select></label></>}<label>Reason (required)<textarea autoFocus={resolution.kind !== 'map'} required minLength={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} rows={3} /></label>{error && <p role="alert" className="error">{error}</p>}<div className="actions"><button type="button" className="secondary" disabled={busy} onClick={() => setResolution(null)}>Cancel</button><button className="primary" disabled={busy || reason.trim().length < 3}>{busy ? 'Saving…' : 'Confirm decision'}</button></div></form></section></div>}
    {showCallModal && (
      <div className="modal-backdrop">
        <section className="modal" style={{ maxWidth: 640 }} role="dialog" aria-modal="true">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <PhoneCall size={20} color="#2563eb" /> Faculty Voice Call Simulation
            </h2>
            <button className="icon-button" onClick={() => setShowCallModal(false)} style={{ fontSize: 18 }}>×</button>
          </div>
          <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 12 }}>
            Test live multi-lingual voice updates (Tamil, Tanglish, English). Test directly in browser or trigger a real phone call to mobile.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              className={simMode === 'simulate' ? 'primary' : 'secondary'}
              onClick={() => setSimMode('simulate')}
              style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
            >
              🎙️ In-Browser Simulation
            </button>
            <button
              className={simMode === 'phone' ? 'primary' : 'secondary'}
              onClick={() => setSimMode('phone')}
              style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
            >
              📞 Live Mobile Call (Twilio)
            </button>
          </div>

          {simMode === 'simulate' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
                  Live Multi-Turn Voice Interview:
                </span>
                <button
                  type="button"
                  className="secondary"
                  style={{ fontSize: 10, padding: '3px 8px' }}
                  onClick={startNewConversation}
                >
                  🔄 Restart Call
                </button>
              </div>

              {/* Chat turns display */}
              <div style={{
                maxHeight: 280,
                overflowY: 'auto',
                padding: 12,
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                marginBottom: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                {chatHistory.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: m.sender === 'user' ? '#2563eb' : '#ffffff',
                      color: m.sender === 'user' ? '#ffffff' : '#1e293b',
                      padding: '10px 14px',
                      borderRadius: 10,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      border: m.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 3, opacity: 0.8 }}>
                      {m.sender === 'user' ? '👤 Faculty' : '🤖 AcademicFlow Voice Agent'}
                    </div>
                    <div>{m.text}</div>
                    {m.tamil && (
                      <div style={{ marginTop: 4, fontSize: 11, color: m.sender === 'user' ? '#dbeafe' : '#2563eb' }}>
                        {m.tamil}
                      </div>
                    )}
                  </div>
                ))}
                {simLoading && (
                  <div style={{ alignSelf: 'flex-start', fontSize: 11, color: '#64748b', fontStyle: 'italic', padding: '6px 12px' }}>
                    🤖 Claude is analyzing speech and formulating clarification…
                  </div>
                )}
              </div>

              {/* Quick test preset shortcuts */}
              {!chatComplete && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                    Quick Responses (Click to test):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button
                      type="button"
                      className="secondary"
                      style={{ fontSize: 10, padding: '3px 7px' }}
                      disabled={simLoading}
                      onClick={() => sendChatTurn('Inaikku Linked List eduthen')}
                    >
                      1️⃣ "Inaikku Linked List eduthen" (Partial $\rightarrow$ Triggers Clarification)
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      style={{ fontSize: 10, padding: '3px 7px' }}
                      disabled={simLoading}
                      onClick={() => sendChatTurn('CSE-C ku singly linked list eduthen, fully completed.')}
                    >
                      2️⃣ "CSE-C ku singly linked list, completed" (Resolves Clarification)
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      style={{ fontSize: 10, padding: '3px 7px' }}
                      disabled={simLoading}
                      onClick={() => sendChatTurn('Completed SQL Joins in DBMS for CSE-C today')}
                    >
                      3️⃣ "Completed SQL Joins for CSE-C" (1-Turn Complete)
                    </button>
                  </div>
                </div>
              )}

              {/* Input for user response */}
              {!chatComplete ? (
                <form
                  onSubmit={e => { e.preventDefault(); sendChatTurn(); }}
                  style={{ display: 'flex', gap: 8 }}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Speak or type faculty update (Tamil, Tanglish or English)..."
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                    disabled={simLoading}
                  />
                  <button
                    type="submit"
                    className="primary"
                    disabled={simLoading || !chatInput.trim()}
                    style={{ fontSize: 12, padding: '0 16px' }}
                  >
                    {simLoading ? 'Thinking…' : 'Send'}
                  </button>
                </form>
              ) : (
                <div style={{ padding: 12, background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: 12, color: '#065f46' }}>✓ Interview Finalized & Grounded in Syllabus</strong>
                    <span className="badge completed">{chatMatchResult?.decision || 'COMPLETED'}</span>
                  </div>
                  {chatMatchResult && (
                    <div style={{ fontSize: 11, color: '#047857' }}>
                      <p style={{ margin: '2px 0' }}><strong>Topic:</strong> {chatMatchResult.topic}</p>
                      <p style={{ margin: '2px 0' }}><strong>Target Class:</strong> {chatMatchResult.department} - {chatMatchResult.section}</p>
                      <p style={{ margin: '2px 0' }}><strong>Syllabus Match:</strong> {chatMatchResult.matched_activity || 'Matched to syllabus'} ({chatMatchResult.confidence}%)</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {simMode === 'phone' && (
            <div>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Faculty Mobile Number (with country code):
                </span>
                <input
                  type="tel"
                  value={callPhone}
                  onChange={e => setCallPhone(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  placeholder="+916380221196"
                />
              </label>
              <button
                className="primary"
                disabled={callLoading || !callPhone.trim()}
                onClick={handleTriggerPhoneCall}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {callLoading ? 'Initiating Call via Twilio…' : '📞 Call Phone Now'}
              </button>
              {callResult && (
                <div style={{ marginTop: 14, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
                  ✓ Outbound call queued to <strong>{callResult.to}</strong>! (SID: {callResult.call_sid?.slice(0, 10)}…)
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#15803d' }}>
                    Pick up your phone to hear the Tamil & English greeting, speak your update, and check the dashboard review queue!
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="secondary" onClick={() => setShowCallModal(false)}>Close</button>
          </div>
        </section>
      </div>
    )}
  </div>;
}

function CandidateCard({ candidate: c, children }: { candidate: Candidate; children?: React.ReactNode }) {
  return <div className="candidate"><div><strong>{c.activity?.activity_name || 'No candidate found'}</strong><b className={c.final_confidence >= 90 ? 'confidence high' : c.final_confidence >= 50 ? 'confidence medium' : 'confidence low'}>{c.final_confidence.toFixed(1)}%</b></div><p>{c.activity ? `${c.activity.course} · ${c.activity.unit} · ${c.activity.class_section}` : 'Original event retained for review'}</p><p>{c.match_reason}</p><small>{c.decision_type} · AI-assisted — review when uncertain</small>{children}</div>;
}
function Empty({ text }: { text: string }) { return <div className="empty"><ClipboardList size={30} /><p>{text}</p></div>; }
function AuditTimeline({ entries }: { entries: Audit[] }) {
  return <section className="panel"><div className="panel-heading"><h2>Decision timeline</h2><span>{entries.length} records</span></div>{!entries.length ? <Empty text="No audit events available in your scope." /> : <div className="timeline">{entries.map(a => <details key={a.id}><summary><span className="timeline-dot" /><div><strong>{a.action.replaceAll('_',' ')}</strong><small>{new Date(a.timestamp).toLocaleString()} · Actor {a.performed_by}</small></div></summary><pre>{JSON.stringify({ previous: a.previous_value, next: a.new_value, metadata: a.details }, null, 2)}</pre></details>)}</div>}</section>;
}
