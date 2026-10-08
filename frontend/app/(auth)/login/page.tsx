'use client';

import { FormEvent, useState } from 'react';
import {
  GraduationCap,
  ArrowRight,
  Eye,
  EyeOff,
  BookOpen,
  Activity,
  Sparkles,
  Award,
  ShieldCheck,
  Lock,
  Mail,
  Check
} from 'lucide-react';
import { post } from '@/lib/api';
import { User } from '@/types';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const { login } = useAuth();

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await post<{ user: User }>('/auth/login', {
        email: data.get('email'),
        password: data.get('password'),
      });
      login(response.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-12 overflow-hidden bg-gradient-to-br from-[#EEF2FF] via-[#F5F0FF] to-[#FDF2F8]">
      {/* Dynamic Ambient Background Elements */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-200/45 filter blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-purple-200/40 filter blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 left-1/4 w-[28rem] h-[28rem] rounded-full bg-pink-100/50 filter blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-cyan-100/40 filter blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* ================= LEFT COLUMN: BRANDING & VALUE PROPOSITION ================= */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-8 lg:pr-4">
          
          {/* Brand & Tagline */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-[#E0E7FF] shadow-xs">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white shadow-xs">
                <GraduationCap size={14} />
              </div>
              <span className="text-xs font-bold tracking-widest text-[#1E293B] uppercase">
                AcademicFlow
              </span>
              <span className="w-1 h-1 rounded-full bg-[#7C3AED]" />
              <span className="text-[11px] font-semibold text-[#64748B] tracking-wide">
                PLAN • TRACK • ACHIEVE
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-[1.15]">
              Your Academic Journey,{' '}
              <span className="bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">
                Simplified.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#64748B] font-normal max-w-lg leading-relaxed">
              Plan smarter. Track better. Achieve together. An AI-powered workspace engineered for modern academia.
            </p>
          </div>

          {/* 4 Professional Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Feature 1: Plan */}
            <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-sm border border-[#E2E8F0]/80 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
              <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#2563EB] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <BookOpen size={18} />
              </div>
              <h2 className="text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">1. Plan</h2>
              <p className="text-xs text-[#64748B] mt-0.5 leading-snug">
                Organize academic activities, syllabus units, and timelines.
              </p>
            </div>

            {/* Feature 2: Track */}
            <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-sm border border-[#E2E8F0]/80 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
              <div className="w-9 h-9 rounded-xl bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Activity size={18} />
              </div>
              <h2 className="text-sm font-bold text-[#0F172A] group-hover:text-[#7C3AED] transition-colors">2. Track</h2>
              <p className="text-xs text-[#64748B] mt-0.5 leading-snug">
                Monitor execution, attendance, and practical progress seamlessly.
              </p>
            </div>

            {/* Feature 3: Get Insights */}
            <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-sm border border-[#E2E8F0]/80 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
              <div className="w-9 h-9 rounded-xl bg-[#FDF2F8] text-[#EC4899] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Sparkles size={18} />
              </div>
              <h2 className="text-sm font-bold text-[#0F172A] group-hover:text-[#EC4899] transition-colors">3. Get Insights</h2>
              <p className="text-xs text-[#64748B] mt-0.5 leading-snug">
                Understand academic delivery with AI-assisted mapping and reports.
              </p>
            </div>

            {/* Feature 4: Achieve */}
            <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-sm border border-[#E2E8F0]/80 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
              <div className="w-9 h-9 rounded-xl bg-[#ECFEFF] text-[#0891B2] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Award size={18} />
              </div>
              <h2 className="text-sm font-bold text-[#0F172A] group-hover:text-[#0891B2] transition-colors">4. Achieve</h2>
              <p className="text-xs text-[#64748B] mt-0.5 leading-snug">
                Stay on schedule, eliminate backlogs, and elevate outcomes.
              </p>
            </div>
          </div>

          {/* Sophisticated Architectural / Campus Graphic */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-white/70 via-white/85 to-[#F0FDF4]/50 border border-[#E2E8F0]/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2563EB]/10 via-[#7C3AED]/10 to-[#06B6D4]/10 border border-[#E2E8F0] flex items-center justify-center shrink-0">
              <svg
                width="28"
                height="28"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#2563EB]"
              >
                {/* Architectural Campus Motif */}
                <path
                  d="M16 4L3 10L16 16L29 10L16 4Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M7 12V22C7 22 11 25 16 25C21 25 25 22 25 22V12"
                  stroke="#7C3AED"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 16V28"
                  stroke="#0891B2"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="16" cy="16" r="2.5" fill="#EC4899" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#0F172A]">
                  Institutional Campus Architecture
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB]">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Accredited course delivery, verified faculty activity logs, and real-time student milestones.
              </p>
            </div>
          </div>

          {/* Motivational Academic Quote */}
          <div className="border-l-2 border-[#7C3AED]/60 pl-3.5 py-1">
            <blockquote className="text-xs sm:text-sm italic text-[#475569] font-medium leading-relaxed">
              &ldquo;Education is not the learning of facts, but the training of the mind to think.&rdquo;
            </blockquote>
            <p className="text-[11px] font-semibold text-[#7C3AED] uppercase tracking-wider mt-1">
              — Academic Flow Intelligence
            </p>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: MODERN LOGIN CARD ================= */}
        <div className="lg:col-span-6 flex justify-center w-full">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl border border-white/80 shadow-[0_12px_40px_-12px_rgba(37,99,235,0.12)] p-6 sm:p-9 relative animate-in fade-in zoom-in-95 duration-500">
            
            {/* Header / Brand Icon */}
            <div className="text-center space-y-2 mb-6">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white shadow-md shadow-blue-500/20 mb-3">
                <GraduationCap size={26} />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
                Welcome Back
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B]">
                Sign in to continue to your AcademicFlow workspace
              </p>
            </div>

            {/* Form */}
            <form onSubmit={authenticate} className="space-y-4">
              
              {/* Email / Handle Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email-input"
                  className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider"
                >
                  Institutional Email / Account
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                    <Mail size={16} />
                  </div>
                  <input
                    id="email-input"
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="e.g. hod@academicflow.edu"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#F8FAFC] text-[#0F172A] text-sm rounded-xl border border-[#E2E8F0] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] transition-all"
                  />
                </div>
              </div>

              {/* Password Input with Show/Hide Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password-input"
                    className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider"
                  >
                    Password
                  </label>
                  <a
                    href="#forgot-password"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Please contact your institutional administrator or use one of the quick demo accounts below.');
                    }}
                    className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                    <Lock size={16} />
                  </div>
                  <input
                    id="password-input"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#F8FAFC] text-[#0F172A] text-sm rounded-xl border border-[#E2E8F0] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#475569] transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <span className="text-xs text-[#64748B] font-medium">Remember my session</span>
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-md">
                  <Check size={12} /> Live Backend Ready
                </span>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium text-center animate-in fade-in"
                >
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={busy}
                className="w-full h-11 text-sm font-semibold rounded-xl bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED] hover:from-[#1D4ED8] hover:to-[#6D28D9] text-white shadow-md shadow-blue-500/25 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {busy ? (
                  <span>Authenticating…</span>
                ) : (
                  <>
                    <span>Sign in securely</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </form>

            {/* Subtle Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E2E8F0]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2.5 text-[#94A3B8] font-semibold text-[10px] tracking-wider">
                  Quick Institutional Accounts
                </span>
              </div>
            </div>

            {/* Demo Quick Sign-In Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const emailInput = document.getElementById('email-input') as HTMLInputElement;
                  const passwordInput = document.getElementById('password-input') as HTMLInputElement;
                  if (emailInput && passwordInput) {
                    emailInput.value = 'hod@academicflow.edu';
                    passwordInput.value = 'hod123456789';
                  }
                }}
                className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 text-left transition-all group active:scale-[0.98] cursor-pointer"
              >
                <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center justify-between">
                  <span>HOD (CSE)</span>
                  <span className="text-[9px] bg-blue-200/70 text-blue-800 px-1 rounded">Admin</span>
                </div>
                <div className="text-xs font-mono font-semibold text-[#1E293B] truncate mt-0.5">hod@academicflow.edu</div>
                <div className="text-[10px] text-text-muted">Click to fill</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const emailInput = document.getElementById('email-input') as HTMLInputElement;
                  const passwordInput = document.getElementById('password-input') as HTMLInputElement;
                  if (emailInput && passwordInput) {
                    emailInput.value = 'teacher@academicflow.edu';
                    passwordInput.value = 'teacher123456';
                  }
                }}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-left transition-all group active:scale-[0.98] cursor-pointer"
              >
                <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                  <span>Faculty (CSE)</span>
                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded">Teacher</span>
                </div>
                <div className="text-xs font-mono font-semibold text-[#1E293B] truncate mt-0.5">teacher@academicflow.edu</div>
                <div className="text-[10px] text-text-muted">Click to fill</div>
              </button>
            </div>

            {/* Security & Role-based Access Footer */}
            <div className="mt-5 pt-4 border-t border-[#F1F5F9] flex items-center justify-center gap-2 text-center text-[10px] text-[#94A3B8]">
              <ShieldCheck size={13} className="text-[#10B981]" />
              <span>Enterprise Encryption • Role-Based Access (RBAC)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
