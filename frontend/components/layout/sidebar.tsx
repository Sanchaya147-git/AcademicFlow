'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap, LayoutDashboard, FileText, SearchCheck,
  CircleHelp, BookOpen, CalendarDays, BarChart3, ShieldCheck,
  Settings, Bell, Users, Sparkles
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { cn } from '@/lib/utils';
import { LogoMark, Wordmark } from '@/components/logo';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/classrooms', label: 'Classrooms & Hub', icon: Users },
  { href: '/plan-generator', label: 'AI Plan Prompter', icon: Sparkles, roleRestricted: true },
  { href: '/activities', label: 'Master Plan', icon: BookOpen },
  { href: '/reports', label: 'Faculty Reports', icon: FileText },
  { href: '/review', label: 'AI Matching & Review', icon: SearchCheck, roleRestricted: true },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/unmatched', label: 'Unmatched', icon: CircleHelp, roleRestricted: true },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/audit', label: 'Audit Trail', icon: ShieldCheck },
];

export function Sidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;
  const isReviewer = ['ADMIN', 'COORDINATOR', 'HOD'].includes(user.role);

  return (
    <aside className={cn(
      'w-64 bg-sidebar flex flex-col flex-shrink-0 min-h-screen overflow-y-auto border-r border-border-subtle bg-white',
      className
    )}>
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard" onClick={onClose} className="brand flex items-center gap-3 group" aria-label="AcademicFlow home">
            <LogoMark size={38} live={true} />
            <div>
              <div className="font-extrabold text-base leading-tight tracking-tight">
                <Wordmark />
              </div>
              <div className="text-[9px] font-bold tracking-[0.18em] text-text-muted uppercase mt-0.5">
                EXECUTION INTELLIGENCE
              </div>
            </div>
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors"
              aria-label="Close menu"
            >
              ✕
            </button>
          )}
        </div>

        {/* User chip */}
        <div className="rounded-xl border border-border-subtle bg-primary-light/60 p-3 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 text-white"
            style={{ background: 'linear-gradient(135deg, #4F6EF7, #A78BFA)' }}>
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-bold text-text-primary truncate">{user.name}</div>
            <div className="text-[10px] text-text-muted truncate capitalize">
              {user.role.replaceAll('_', ' ').toLowerCase()}
            </div>
          </div>
        </div>

        {/* Nav section label */}
        <div className="text-[10px] tracking-[0.15em] font-bold text-text-muted mb-2 ml-1 uppercase">
          Menu
        </div>

        <nav className="flex flex-col gap-0.5">
          {navLinks.map((link) => {
            if (link.roleRestricted && !isReviewer) return null;
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:bg-accent-violet/60 hover:text-text-primary'
                )}
              >
                <link.icon size={17} className="shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="mt-auto p-6 pt-2 space-y-1">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            pathname === '/settings'
              ? 'bg-primary text-white'
              : 'text-text-muted hover:bg-accent-violet/60 hover:text-text-primary'
          )}
        >
          <Settings size={17} className="shrink-0" />
          Settings
        </Link>

        {/* Info badge */}
        <div className="rounded-xl border border-accent-violet bg-accent-violet/40 p-4 mt-4">
          <div className="flex items-center gap-2 text-primary font-semibold mb-1.5 text-xs">
            <ShieldCheck size={14} /> Human-in-the-loop
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            AI-assisted matching — every decision retains its evidence trail.
          </p>
        </div>
      </div>
    </aside>
  );
}
