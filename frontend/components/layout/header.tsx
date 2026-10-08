'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Menu, Bell, LogOut, Search, Download, Mail, Sparkles,
  PhoneCall, FileText, CheckCircle2, AlertCircle, Send, Check,
  User, Settings as SettingsIcon, ShieldCheck, ChevronRight, X, Clock, Trash2,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { API_BASE, post } from '@/lib/api';
import { LogoMark, Wordmark } from '@/components/logo';

type NotificationItem = {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'email' | 'ai' | 'voice' | 'review';
  read: boolean;
};

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'Master Plan Emailed',
      desc: 'Institutional plan sent to sanchaya06@gmail.com via Twilio Comms API',
      time: 'Just now',
      type: 'email',
      read: false,
    },
    {
      id: 'notif-2',
      title: 'Syllabus Auto-Linked',
      desc: 'Session #12 auto-linked at 94.2% confidence (Highest Score Rule)',
      time: '15m ago',
      type: 'ai',
      read: false,
    },
    {
      id: 'notif-3',
      title: 'Voice Call Recorded',
      desc: 'AI Voice turn transcribed for +919952840506',
      time: '1h ago',
      type: 'voice',
      read: true,
    },
    {
      id: 'notif-4',
      title: 'Review Queue Updated',
      desc: '1 activity waiting for coordinator verification',
      time: '2h ago',
      type: 'review',
      read: true,
    },
  ]);

  // Profile Menu State
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function clearNotifications() {
    setNotifications([]);
  }

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
      setNotifications(prev => [
        {
          id: 'notif-' + Date.now(),
          title: mode === 'live' ? 'Master Plan Dispatched (Twilio)' : 'Master Plan Simulated',
          desc: `Delivered to ${emailRecipient}`,
          time: 'Just now',
          type: 'email',
          read: false,
        },
        ...prev
      ]);
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
        setNotifications(prev => [
          {
            id: 'notif-' + Date.now(),
            title: 'Voice Session Finalized',
            desc: `Matched ${res.match_result?.matched_activity || 'Activity'} (${res.match_result?.confidence}%)`,
            time: 'Just now',
            type: 'ai',
            read: false,
          },
          ...prev
        ]);
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
      setNotifications(prev => [
        {
          id: 'notif-' + Date.now(),
          title: 'Twilio Outbound Call Placed',
          desc: `Call queued for ${callPhone}`,
          time: 'Just now',
          type: 'voice',
          read: false,
        },
        ...prev
      ]);
    } catch (err: any) {
      alert(`Call failed: ${err.message}`);
    } finally {
      setCallLoading(false);
    }
  }

  return (
    <header className="h-16 bg-white/90 backdrop-blur-md border-b border-border-subtle flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-30 shadow-2xs">
      {/* Left: Brand Logo + Mobile menu toggle + search */}
      <div className="flex items-center gap-3.5 flex-1 max-w-md">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-text-muted hover:text-text-primary rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Brand Logo in Header */}
        <Link href="/dashboard" className="brand flex items-center gap-2.5 mr-2 shrink-0 group" aria-label="AcademicFlow home">
          <LogoMark size={34} live={true} />
          <div className="hidden sm:block">
            <div className="font-extrabold text-sm text-text-primary leading-tight tracking-tight flex items-center gap-1.5">
              <Wordmark />
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary-light text-primary uppercase">v1.0</span>
            </div>
            <div className="text-[9px] font-semibold text-text-muted tracking-wider uppercase">
              Plan • Track • Achieve
            </div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-2 bg-slate-50/80 border border-border-subtle rounded-xl px-3 py-1.5 flex-1 focus-within:bg-white focus-within:border-primary/50 transition-colors">
          <Search size={14} className="text-text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search syllabus, courses, faculty…"
            className="bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Center/Actions: Master Excel, Email Plan, Simulate Call */}
      <div className="flex items-center gap-2">
        <a
          href={`${API_BASE}/api/excel/master`}
          download="master_academic_plan.xlsx"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-subtle bg-white text-xs font-semibold text-text-primary hover:bg-slate-50 active:scale-[0.97] transition-all shadow-2xs"
          title="Download live Master Academic Plan workbook"
        >
          <Download size={14} className="text-emerald-600" />
          <span className="hidden sm:inline">Master Excel</span>
        </a>

        {isHod && (
          <>
            <button
              onClick={() => { setShowEmailModal(true); setEmailMode('live'); setEmailResult(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-subtle bg-white text-xs font-semibold text-text-primary hover:bg-slate-50 active:scale-[0.97] transition-all shadow-2xs cursor-pointer"
              title="Dispatch plan to HOD mailbox via Twilio"
            >
              <Mail size={14} className="text-blue-600" />
              <span className="hidden md:inline">Email Plan</span>
            </button>

            <button
              onClick={() => { setShowEmailModal(true); setEmailMode('simulate'); handleSendEmail('simulate'); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-200 bg-violet-50 text-xs font-semibold text-violet-700 hover:bg-violet-100 active:scale-[0.97] transition-all shadow-2xs cursor-pointer"
              title="Simulate email dispatch with Excel attachment"
            >
              <Sparkles size={14} className="text-violet-600" />
              <span className="hidden lg:inline">Simulate Mail</span>
            </button>
          </>
        )}

        <button
          onClick={() => { setShowCallModal(true); startNewConversation(); setCallResult(null); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 active:scale-[0.97] transition-all shadow-2xs cursor-pointer"
          title="Simulate Twilio phone call or interactive browser voice dialog"
        >
          <PhoneCall size={14} className="text-amber-600" />
          <span className="hidden sm:inline">Simulate Call</span>
        </button>
      </div>

      {/* Right: notifications + avatar + profile menu + logout */}
      <div className="flex items-center gap-2 ml-3">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-text-muted hover:text-text-primary hover:bg-slate-100 rounded-xl active:scale-95 transition-all cursor-pointer"
            aria-label="Notifications"
            title="System Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <>
                <span className="animate-ping absolute top-1 right-1 h-3 w-3 rounded-full bg-rose-400 opacity-75" />
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white shadow-xs">
                  {unreadCount}
                </span>
              </>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-border-subtle z-50 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
              <div className="p-3.5 bg-slate-50/80 border-b border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={15} className="text-primary" />
                  <span className="text-xs font-bold text-text-primary">System Notifications</span>
                  {unreadCount > 0 && (
                    <span className="bg-primary-light text-primary text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] text-primary hover:underline font-semibold"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      className="text-text-muted hover:text-danger p-1 rounded"
                      title="Clear notifications"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border-subtle/60">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-text-muted">
                    <CheckCircle2 size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-medium">All caught up!</p>
                    <p className="text-[11px] text-text-muted mt-0.5">No unread alerts or notifications.</p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3.5 hover:bg-slate-50/80 transition-colors flex items-start gap-3 ${
                        !item.read ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        item.type === 'email' ? 'bg-blue-100 text-blue-600' :
                        item.type === 'ai' ? 'bg-violet-100 text-violet-600' :
                        item.type === 'voice' ? 'bg-amber-100 text-amber-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {item.type === 'email' && <Mail size={14} />}
                        {item.type === 'ai' && <Sparkles size={14} />}
                        {item.type === 'voice' && <PhoneCall size={14} />}
                        {item.type === 'review' && <CheckCircle2 size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={`text-xs ${!item.read ? 'font-bold text-text-primary' : 'font-semibold text-text-primary'}`}>
                            {item.title}
                          </span>
                          <span className="text-[10px] text-text-muted flex items-center gap-0.5 shrink-0">
                            <Clock size={10} /> {item.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed truncate">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Popover */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 pl-1.5 rounded-xl hover:bg-accent-violet/30 transition-colors cursor-pointer"
            title="Profile & Settings"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 text-white shadow-2xs"
              style={{ background: 'linear-gradient(135deg, #4F6EF7, #A78BFA)' }}
            >
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-text-primary leading-tight">{user.name}</div>
              <div className="text-[10px] text-text-muted capitalize leading-tight">
                {user.role.replaceAll('_', ' ').toLowerCase()}
              </div>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-border-subtle z-50 p-3 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 bg-slate-50/80 rounded-xl mb-2 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 text-white shadow-xs"
                  style={{ background: 'linear-gradient(135deg, #4F6EF7, #A78BFA)' }}
                >
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-text-primary truncate">{user.name}</div>
                  <div className="text-[10px] text-text-muted truncate">{user.email}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                      {user.role}
                    </span>
                    {user.department && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-200/80 text-text-muted">
                        {user.department}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-0.5">
                <Link
                  href="/settings"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center justify-between px-3 py-2 text-xs font-medium text-text-primary hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <SettingsIcon size={14} className="text-primary" /> Settings & Configuration
                  </span>
                  <ChevronRight size={13} className="text-text-muted" />
                </Link>

                <button
                  onClick={() => { setShowProfileMenu(false); logout(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- HOD Email Center Modal (Portaled directly to document.body) --- */}
      {mounted && showEmailModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <section className="bg-white rounded-2xl shadow-2xl border border-border-subtle max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200 relative my-auto">
            <button
              onClick={() => setShowEmailModal(false)}
              className="absolute top-4 right-4 p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-slate-100"
              title="Close"
            >
              <X size={18} />
            </button>

            <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4 pr-8">
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
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                <Mail size={14} />
                {emailSending && emailMode === 'live' ? 'Sending via Twilio…' : 'Send via Twilio'}
              </button>
              <button
                disabled={emailSending || !emailRecipient.trim()}
                onClick={() => handleSendEmail('simulate')}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold disabled:opacity-50 transition-all shadow-xs cursor-pointer"
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
        </div>,
        document.body
      )}

      {/* --- Twilio Voice / Call Simulator Modal (Portaled directly to document.body) --- */}
      {mounted && showCallModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <section className="bg-white rounded-2xl shadow-2xl border border-border-subtle max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200 relative my-auto">
            <button
              onClick={() => setShowCallModal(false)}
              className="absolute top-4 right-4 p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-slate-100"
              title="Close"
            >
              <X size={18} />
            </button>

            <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4 pr-8">
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

                <div className="h-64 overflow-y-auto p-3.5 bg-slate-50 rounded-xl border border-border-subtle space-y-2.5 mb-3">
                  {chatHistory.map((m, idx) => (
                    <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-primary text-white rounded-tr-none'
                          : 'bg-white border border-border-subtle text-text-primary rounded-tl-none shadow-2xs'
                      }`}>
                        <p>{m.text}</p>
                        {m.tamil && <p className="text-[11px] opacity-85 mt-1 border-t border-border-subtle/40 pt-1 text-slate-700">{m.tamil}</p>}
                      </div>
                    </div>
                  ))}
                  {simLoading && (
                    <div className="text-[11px] text-text-muted italic flex items-center gap-1.5 p-2 bg-white/70 rounded-xl">
                      <Sparkles size={13} className="animate-spin text-primary" /> Claude Haiku thinking…
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
                      className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="submit"
                      disabled={simLoading || !chatInput.trim()}
                      className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Send size={13} />
                    </button>
                  </form>
                ) : (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs">
                    <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-900">
                      <CheckCircle2 size={15} /> Update Synchronized to Master Plan & Excel!
                    </div>
                    {chatMatchResult && (
                      <p className="text-[11px] text-emerald-700">
                        Matched: <strong>{chatMatchResult.matched_activity || chatMatchResult.topic}</strong> (Confidence: {chatMatchResult.confidence}%)
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
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border-subtle bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="+919952840506"
                  />
                </label>

                <button
                  disabled={callLoading || !callPhone.trim()}
                  onClick={handleTriggerPhoneCall}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2 mb-3 shadow-xs cursor-pointer"
                >
                  <PhoneCall size={14} />
                  {callLoading ? 'Initiating Twilio Outbound Call…' : '📞 Call My Phone Now (+919952840506)'}
                </button>

                {callResult && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
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
        </div>,
        document.body
      )}
    </header>
  );
}
