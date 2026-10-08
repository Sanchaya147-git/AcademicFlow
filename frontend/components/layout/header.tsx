'use client';
import { useState } from 'react';
import {
  Menu, Bell, LogOut, Search, Download, Mail, Sparkles,
  PhoneCall, FileText, CheckCircle2, AlertCircle, Send, Check
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { API_BASE, post } from '@/lib/api';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();

  // Email Modal State (Default to sanchaya06@gmail.com)
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('sanchaya06@gmail.com');
  const [emailMode, setEmailMode] = useState<'live' | 'simulate'>('live');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<any>(null);
  const [emailError, setEmailError] = useState('');

  // Call Modal State (Default to +919952840506)
  const [showCallModal, setShowCallModal] = useState(false);
  const [callPhone, setCallPhone] = useState('+919952840506');
  const [callLoading, setCallLoading] = useState(false);
  const [callResult, setCallResult] = useState<any>(null);
  const [simMode, setSimMode] = useState<'interactive' | 'phone'>('interactive');
  const [simLoading, setSimLoading] = useState(false);
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

  if (!user) return null;
  const isHod = ['HOD', 'ADMIN'].includes(user.role);

  async function handleSendEmail(mode: 'live' | 'simulate') {
    setEmailMode(mode);
    setEmailSending(true);
    setEmailError('');
    setEmailResult(null);
    try {
      const res = await post<any>('/email/send-master-plan', {
        recipient: emailRecipient,
        mode: mode,
      });
      setEmailResult(res);
    } catch (err) {
      setEmailError((err as Error).message);
    } finally {
      setEmailSending(false);
    }
  }

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
    setSimLoading(true);
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  }

  async function handleTriggerPhoneCall() {
    setCallLoading(true);
    setCallResult(null);
    try {
      const res = await post<any>(`/webhook/voice/call?to_phone=${encodeURIComponent(callPhone)}`);
      setCallResult(res);
    } catch (err: any) {
      alert(`Call failed: ${err.message}`);
    } finally {
      setCallLoading(false);
    }
  }

  return (
    <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-border-subtle flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-30">
      {/* Left: mobile menu + search */}
      <div className="flex items-center gap-3 flex-1 max-w-sm">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-accent-violet/40 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="hidden sm:flex items-center gap-2 bg-background border border-border-subtle rounded-xl px-3 py-1.5 flex-1">
          <Search size={14} className="text-text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search syllabus, classes…"
            className="bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Center/Actions: Master Excel, Email Plan, Simulate Call */}
      <div className="flex items-center gap-2">
        <a
          href={`${API_BASE}/api/excel/master`}
          download="master_academic_plan.xlsx"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-subtle bg-white text-xs font-semibold text-text-primary hover:bg-slate-50 transition-colors shadow-2xs"
          title="Download live Master Academic Plan workbook"
        >
          <Download size={13} className="text-emerald-600" />
          <span className="hidden sm:inline">Master Excel</span>
        </a>

        {isHod && (
          <>
            <button
              onClick={() => { setShowEmailModal(true); setEmailMode('live'); setEmailResult(null); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-subtle bg-white text-xs font-semibold text-text-primary hover:bg-slate-50 transition-colors shadow-2xs"
              title="Dispatch plan to HOD mailbox via Twilio"
            >
              <Mail size={13} className="text-blue-600" />
              <span className="hidden md:inline">Email Plan</span>
            </button>

            <button
              onClick={() => { setShowEmailModal(true); setEmailMode('simulate'); handleSendEmail('simulate'); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors shadow-2xs"
              title="Simulate email dispatch with Excel attachment"
            >
              <Sparkles size={13} className="text-violet-600" />
              <span className="hidden lg:inline">Simulate Mail</span>
            </button>
          </>
        )}

        <button
          onClick={() => { setShowCallModal(true); startNewConversation(); setCallResult(null); }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
          title="Simulate Twilio phone call or interactive browser voice dialog"
        >
          <PhoneCall size={13} className="text-amber-600" />
          <span className="hidden sm:inline">Simulate Call</span>
        </button>
      </div>

      {/* Right: notifications + avatar + logout */}
      <div className="flex items-center gap-2 ml-3">
        <button
          className="relative p-2 text-text-muted hover:text-text-primary hover:bg-accent-violet/40 rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border-2 border-white" />
        </button>

        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 text-white ml-1"
          style={{ background: 'linear-gradient(135deg, #4F6EF7, #A78BFA)' }}>
          {user.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="hidden md:block">
          <div className="text-xs font-semibold text-text-primary leading-tight">{user.name}</div>
          <div className="text-[10px] text-text-muted capitalize leading-tight">
            {user.role.replaceAll('_', ' ').toLowerCase()}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          title="Sign out"
          className="text-text-muted hover:text-danger hover:bg-danger/10 ml-1"
        >
          <LogOut size={17} />
        </Button>
      </div>

      {/* --- HOD Email Center Modal --- */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <section className="bg-white rounded-2xl shadow-xl border border-border-subtle max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Mail size={18} className="text-blue-600" /> HOD Master Plan Email Dispatch
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                HOD EXCLUSIVE
              </span>
            </div>

            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              Send the synchronized institutional <strong>master_academic_plan.xlsx</strong> spreadsheet directly to the Department Head via Twilio Comms Email API.
            </p>

            <label className="block mb-4">
              <span className="block text-xs font-semibold text-text-primary mb-1">
                Recipient Email:
              </span>
              <input
                type="email"
                value={emailRecipient}
                onChange={e => setEmailRecipient(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-border-subtle bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="sanchaya06@gmail.com"
              />
            </label>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-border-subtle mb-4 text-xs">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-emerald-600 shrink-0" />
                <span className="font-semibold text-text-primary">master_academic_plan.xlsx</span>
              </div>
              <a
                href={`${API_BASE}/api/excel/master`}
                download
                className="text-primary hover:underline font-semibold text-[11px]"
              >
                Download Preview
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                disabled={emailSending || !emailRecipient.trim()}
                onClick={() => handleSendEmail('live')}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold disabled:opacity-50 transition-all shadow-xs"
              >
                <Mail size={14} />
                {emailSending && emailMode === 'live' ? 'Sending via Twilio…' : 'Send via Twilio'}
              </button>
              <button
                disabled={emailSending || !emailRecipient.trim()}
                onClick={() => handleSendEmail('simulate')}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold disabled:opacity-50 transition-all shadow-xs"
              >
                <Sparkles size={14} />
                {emailSending && emailMode === 'simulate' ? 'Simulating…' : 'Simulate Mail'}
              </button>
            </div>

            {emailError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{emailError}</span>
              </div>
            )}

            {emailResult && (
              <div className={`p-3 mb-4 rounded-xl text-xs border ${
                emailResult.mode === 'live'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-violet-50 border-violet-200 text-violet-800'
              }`}>
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{emailResult.mode === 'live' ? '✓ Dispatched via Twilio API' : '⚡ Simulated Dispatch Recorded'}</span>
                  <span className="font-mono text-[10px] bg-white/80 px-1.5 py-0.5 rounded border">
                    {emailResult.operation_id?.slice(0, 18)}…
                  </span>
                </div>
                <p className="text-[11px] leading-tight mb-2">{emailResult.message}</p>
                <div className="text-[10px] opacity-80 flex gap-2">
                  <span>To: {emailResult.recipient}</span> •
                  <span>Size: {emailResult.file_size_bytes} bytes</span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border-subtle">
              <Button variant="outline" size="sm" onClick={() => setShowEmailModal(false)}>
                Close
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* --- Twilio Voice / Call Simulator Modal --- */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <section className="bg-white rounded-2xl shadow-xl border border-border-subtle max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <PhoneCall size={18} className="text-amber-600" /> Twilio Voice Agent Center
              </h2>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  onClick={() => setSimMode('interactive')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    simMode === 'interactive' ? 'bg-white shadow-2xs font-bold text-text-primary' : 'text-text-muted'
                  }`}
                >
                  Browser Voice
                </button>
                <button
                  onClick={() => setSimMode('phone')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    simMode === 'phone' ? 'bg-white shadow-2xs font-bold text-text-primary' : 'text-text-muted'
                  }`}
                >
                  Twilio Phone Call
                </button>
              </div>
            </div>

            {simMode === 'interactive' ? (
              <div>
                <p className="text-xs text-text-muted mb-3">
                  Simulate bilingual English/Tamil AI voice conversation with 2s pause timeout.
                </p>

                <div className="h-56 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-border-subtle space-y-2 mb-3">
                  {chatHistory.map((m, idx) => (
                    <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-2.5 rounded-xl text-xs ${
                        m.sender === 'user'
                          ? 'bg-primary text-white rounded-tr-none'
                          : 'bg-white border border-border-subtle text-text-primary rounded-tl-none shadow-2xs'
                      }`}>
                        <p>{m.text}</p>
                        {m.tamil && <p className="text-[10px] opacity-75 mt-1">{m.tamil}</p>}
                      </div>
                    </div>
                  ))}
                  {simLoading && (
                    <div className="text-[11px] text-text-muted italic flex items-center gap-1">
                      <Sparkles size={12} className="animate-spin text-primary" /> Claude Haiku thinking…
                    </div>
                  )}
                </div>

                {!chatComplete ? (
                  <form onSubmit={(e) => { e.preventDefault(); sendChatTurn(); }} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Say what topic and section you taught…"
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-border-subtle bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="submit"
                      disabled={simLoading || !chatInput.trim()}
                      className="px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      <Send size={13} />
                    </button>
                  </form>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs">
                    <div className="font-bold flex items-center gap-1 mb-1">
                      <CheckCircle2 size={14} /> Update Synchronized to Master Plan!
                    </div>
                    {chatMatchResult && (
                      <p className="text-[11px]">
                        Matched: {chatMatchResult.matched_activity || chatMatchResult.topic} ({chatMatchResult.confidence}%)
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs text-text-muted mb-4">
                  Trigger an outbound phone call via Twilio to your verified mobile number.
                </p>

                <label className="block mb-4">
                  <span className="block text-xs font-semibold text-text-primary mb-1">
                    Mobile Number (with country code):
                  </span>
                  <input
                    type="tel"
                    value={callPhone}
                    onChange={(e) => setCallPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border-subtle bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="+919952840506"
                  />
                </label>

                <button
                  disabled={callLoading || !callPhone.trim()}
                  onClick={handleTriggerPhoneCall}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2 mb-3 shadow-xs"
                >
                  <PhoneCall size={14} />
                  {callLoading ? 'Initiating Twilio Outbound Call…' : '📞 Call My Phone Now'}
                </button>

                {callResult && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                    ✓ Call queued to <strong>{callResult.to}</strong>! (SID: {callResult.call_sid?.slice(0, 10)}…)
                    <p className="text-[11px] text-emerald-700 mt-1">
                      Pick up your phone to converse with the Tamil & English AI agent!
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-border-subtle mt-4">
              <Button variant="outline" size="sm" onClick={() => setShowCallModal(false)}>
                Close
              </Button>
            </div>
          </section>
        </div>
      )}
    </header>
  );
}
