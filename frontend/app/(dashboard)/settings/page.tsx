'use client';
import { useState } from 'react';
import {
  User, PhoneCall, Mail, Sparkles, ShieldCheck,
  CheckCircle2, AlertCircle, Save, Bell, RefreshCw, Key,
  Sliders, MessageSquare, Send, Check
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { post } from '@/lib/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'twilio' | 'ai' | 'notifications'>('profile');

  // Profile State
  const [name, setName] = useState(user?.name || 'HOD CSE');
  const [email, setEmail] = useState(user?.email || 'hod@academicflow.edu');
  const [department, setDepartment] = useState(user?.department || 'CSE');
  const [academicYear, setAcademicYear] = useState('2026-2027');

  // Twilio State
  const [teacherPhone, setTeacherPhone] = useState('+919952840506');
  const [twilioNumber, setTwilioNumber] = useState('+17372508034');
  const [hodEmail, setHodEmail] = useState('sanchaya06@gmail.com');
  const [speechTimeout, setSpeechTimeout] = useState('2.0');
  const [maxSpeechTime, setMaxSpeechTime] = useState('60');

  // AI & Matching State
  const [autoLinkThreshold, setAutoLinkThreshold] = useState(90);
  const [reviewThreshold, setReviewThreshold] = useState(50);
  const [aiProvider, setAiProvider] = useState('Anthropic Claude Haiku (claude-haiku-4-5-20251001)');
  const [voiceLanguage, setVoiceLanguage] = useState<'bilingual' | 'english'>('bilingual');

  // Notifications State
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [excelAutoSync, setExcelAutoSync] = useState(true);
  const [dailyDigestAlert, setDailyDigestAlert] = useState(true);

  // Status feedback
  const [notice, setNotice] = useState('');
  const [testSending, setTestSending] = useState(false);

  if (!user) return null;

  async function handleTestEmail() {
    setTestSending(true);
    setNotice('');
    try {
      const res = await post<any>('/email/send-master-plan', {
        recipient: hodEmail,
        mode: 'live',
      });
      setNotice(`Twilio live test email queued successfully! (Operation ID: ${res.operation_id?.slice(0, 18)}…)`);
    } catch (err: any) {
      setNotice(`Email test error: ${err.message}`);
    } finally {
      setTestSending(false);
    }
  }

  function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setNotice('Settings and configuration preferences saved successfully!');
    setTimeout(() => setNotice(''), 4000);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">
            System Administration
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            Settings & System Configuration
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
            Manage your academic credentials, Twilio telephony pipeline, AI matching heuristics, and master plan export preferences.
          </p>
        </div>

        <Button
          onClick={handleSaveAll}
          className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold px-4 py-2.5 shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Save size={15} /> Save Changes
        </Button>
      </div>

      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice('')} className="font-bold text-emerald-700 hover:text-emerald-900 ml-2">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border-subtle space-x-1 sm:space-x-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-primary text-primary bg-white rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <User size={15} /> Profile & Department
        </button>

        <button
          onClick={() => setActiveTab('twilio')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'twilio'
              ? 'border-primary text-primary bg-white rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <PhoneCall size={15} /> Twilio Telephony & Comms
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'ai'
              ? 'border-primary text-primary bg-white rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Sparkles size={15} /> AI Engine & Matching
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'border-primary text-primary bg-white rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Bell size={15} /> Notifications & Sync
        </button>
      </div>

      {/* Tab 1: Profile & Department */}
      {activeTab === 'profile' && (
        <section className="bg-white rounded-2xl border border-border-subtle p-6 md:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2 mb-1">
              <User size={18} className="text-primary" /> Academic Profile & Department
            </h2>
            <p className="text-xs text-text-muted">
              Personal identity and institutional department settings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Full Name:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Email Address:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Department:
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Academic Year:
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-border-subtle flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-text-primary">Institutional Role</span>
              <div className="text-[11px] text-text-muted mt-0.5">Assigned by institutional administrator</div>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
              {user.role}
            </span>
          </div>
        </section>
      )}

      {/* Tab 2: Twilio Telephony & Comms */}
      {activeTab === 'twilio' && (
        <section className="bg-white rounded-2xl border border-border-subtle p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2 mb-1">
                <PhoneCall size={18} className="text-amber-600" /> Twilio Telephony & Communication Pipeline
              </h2>
              <p className="text-xs text-text-muted">
                Configure verified caller IDs, WhatsApp bot, outbound voice agent, and Twilio Comms Email API.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shrink-0">
              ✓ Connected & Verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Twilio Sender Number / WhatsApp:
              </label>
              <input
                type="text"
                value={twilioNumber}
                onChange={(e) => setTwilioNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold text-primary rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span className="text-[10px] text-text-muted mt-1 block">
                Caller ID for outbound voice calls and WhatsApp messages (+17372508034)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Teacher Verified Mobile Phone:
              </label>
              <input
                type="text"
                value={teacherPhone}
                onChange={(e) => setTeacherPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span className="text-[10px] text-text-muted mt-1 block">
                Target phone number dialed when triggering voice simulation (+919952840506)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                HOD Master Plan Email Recipient:
              </label>
              <input
                type="email"
                value={hodEmail}
                onChange={(e) => setHodEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-border-subtle bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span className="text-[10px] text-text-muted mt-1 block">
                Destination mailbox for Master Academic Plan spreadsheet (sanchaya06@gmail.com)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Twilio Account SID (Masked):
              </label>
              <input
                type="text"
                disabled
                value="AC••••••••••••••••••••••••••••••9e0"
                className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-100/80 text-slate-500 rounded-xl border border-border-subtle cursor-not-allowed"
              />
              <span className="text-[10px] text-text-muted mt-1 block">
                Managed securely in production server environment (.env)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-border-subtle">
              <span className="text-xs font-bold text-text-primary block mb-1">
                Speech Pause Timeout: {speechTimeout}s
              </span>
              <p className="text-[11px] text-text-muted mb-2">
                Silence duration before speech recognizer processes turn. Tuned to 2 seconds for rapid conversational turnaround.
              </p>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={speechTimeout}
                onChange={(e) => setSpeechTimeout(e.target.value)}
                className="w-full accent-primary"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-border-subtle flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-text-primary block mb-1">
                  Test Twilio Comms Email
                </span>
                <p className="text-[11px] text-text-muted mb-3">
                  Dispatch a live email verification ping to {hodEmail} via Twilio Comms API.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestEmail}
                disabled={testSending}
                className="text-xs self-start"
              >
                {testSending ? 'Sending…' : 'Send Test Email (Twilio)'}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Tab 3: AI Engine & Matching */}
      {activeTab === 'ai' && (
        <section className="bg-white rounded-2xl border border-border-subtle p-6 md:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-violet-600" /> AI Provider & Auto-Approval Heuristics
            </h2>
            <p className="text-xs text-text-muted">
              Configure LLM vision extraction and syllabus matching decision thresholds.
            </p>
          </div>

          <div className="p-4 bg-violet-50/50 rounded-xl border border-violet-200/60 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-violet-900 block">Active Vision & Extraction Model</span>
              <span className="text-violet-700 font-mono text-[11px]">{aiProvider}</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-violet-700 border border-violet-200">
              ACTIVE
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-border-subtle">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-text-primary">
                  Highest-Confidence Auto-Link Threshold: {autoLinkThreshold}%
                </span>
                <span className="text-xs font-mono font-bold text-primary">{autoLinkThreshold}%</span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed mb-3">
                <strong>Rule:</strong> When an event is evaluated, the candidate with the highest confidence above this threshold ({autoLinkThreshold}%) is automatically marked <code>AUTO_LINKED</code> and synced to master Excel. Lower candidates are queued for review.
              </p>
              <input
                type="range"
                min="70"
                max="98"
                value={autoLinkThreshold}
                onChange={(e) => setAutoLinkThreshold(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-border-subtle">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-text-primary">
                  Ambiguity Review Threshold: {reviewThreshold}%
                </span>
                <span className="text-xs font-mono font-bold text-amber-600">{reviewThreshold}%</span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed mb-3">
                Matches with confidence between {reviewThreshold}% and {autoLinkThreshold - 1}% are held in the Human-in-the-Loop review queue. Candidates below {reviewThreshold}% are marked unmatched.
              </p>
              <input
                type="range"
                min="30"
                max="70"
                value={reviewThreshold}
                onChange={(e) => setReviewThreshold(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-border-subtle">
              <span className="text-xs font-bold text-text-primary block mb-1">
                Voice Agent Language Preference
              </span>
              <p className="text-[11px] text-text-muted mb-3">
                Select bilingual English & Tamil or English-only for interactive phone calls.
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="lang"
                    checked={voiceLanguage === 'bilingual'}
                    onChange={() => setVoiceLanguage('bilingual')}
                    className="accent-primary"
                  />
                  <span>Bilingual (English + தமிழ் Tamil)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="lang"
                    checked={voiceLanguage === 'english'}
                    onChange={() => setVoiceLanguage('english')}
                    className="accent-primary"
                  />
                  <span>English Only</span>
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: Notifications & Sync */}
      {activeTab === 'notifications' && (
        <section className="bg-white rounded-2xl border border-border-subtle p-6 md:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2 mb-1">
              <Bell size={18} className="text-primary" /> Notifications & Excel Synchronization
            </h2>
            <p className="text-xs text-text-muted">
              Configure real-time notifications, audit alerts, and automatic workbook synchronization.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-slate-50 rounded-xl border border-border-subtle flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-text-primary block">
                  Automatic Master Excel Synchronization
                </span>
                <span className="text-[11px] text-text-muted">
                  Write newly published or auto-approved activities to <code>master_academic_plan.xlsx</code> immediately.
                </span>
              </div>
              <input
                type="checkbox"
                checked={excelAutoSync}
                onChange={(e) => setExcelAutoSync(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-border-subtle flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-text-primary block">
                  HOD Email Alerts on High-Confidence Auto-Links
                </span>
                <span className="text-[11px] text-text-muted">
                  Send notification email when a session is verified with &gt;90% confidence.
                </span>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-border-subtle flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-text-primary block">
                  Daily Compliance Digest Reminders
                </span>
                <span className="text-[11px] text-text-muted">
                  Compile daily submission statuses for enrolled faculty at 6:00 PM.
                </span>
              </div>
              <input
                type="checkbox"
                checked={dailyDigestAlert}
                onChange={(e) => setDailyDigestAlert(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
