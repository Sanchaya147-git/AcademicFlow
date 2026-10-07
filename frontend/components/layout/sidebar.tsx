'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap, LayoutDashboard, FileText, SearchCheck,
  CircleHelp, BookOpen, CalendarDays, BarChart3, ShieldCheck,
  Settings, Bell, Users
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/dashboard',   label: 'Dashboard',          icon: LayoutDashboard },
  { href: '/activities',  label: 'My Plan',             icon: BookOpen },
  { href: '/reports',     label: 'Reports',             icon: FileText },
  { href: '/review',      label: 'AI Matching',         icon: SearchCheck,  roleRestricted: true },
  { href: '/schedule',    label: 'Tasks',               icon: CalendarDays },
  { href: '/unmatched',   label: 'Notifications',       icon: Bell,         roleRestricted: true },
  { href: '/audit',       label: 'Faculty',             icon: Users },
  { href: '/analytics',   label: 'Analytics',           icon: BarChart3 },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;
  const isReviewer = ['ADMIN', 'COORDINATOR', 'HOD'].includes(user.role);

  return (
    <aside className={cn(
      'w-64 bg-sidebar flex flex-col flex-shrink-0 min-h-screen overflow-y-auto border-r border-border-subtle',
      className
    )}>
      {/* Logo */}
      <div className="p-6 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3 mb-8 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #4F6EF7, #A78BFA)' }}>
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <div className="font-extrabold text-base text-text-primary leading-tight tracking-tight">
              AcademicFlow
            </div>
            <div className="text-[9px] font-bold tracking-[0.18em] text-text-muted uppercase mt-0.5">
              Plan&nbsp;•&nbsp;Track&nbsp;•&nbsp;Achieve
            </div>
          </div>
        </Link>

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
