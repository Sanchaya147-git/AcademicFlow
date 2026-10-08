'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Sparkles, BookOpen, FileText,
  SearchCheck, CalendarDays, CircleHelp, BarChart3, ShieldCheck,
  Settings
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { cn } from '@/lib/utils';

export const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/classrooms', label: 'Classrooms & Hub', icon: Users },
  { href: '/plan-generator', label: 'AI Plan Prompter', icon: Sparkles, roleRestricted: true, isAi: true },
  { href: '/activities', label: 'Master Plan', icon: BookOpen },
  { href: '/reports', label: 'Faculty Reports', icon: FileText },
  { href: '/review', label: 'AI Matching & Review', icon: SearchCheck, roleRestricted: true },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/unmatched', label: 'Unmatched', icon: CircleHelp, roleRestricted: true },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/audit', label: 'Audit Trail', icon: ShieldCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function TopNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;
  const isReviewer = ['ADMIN', 'COORDINATOR', 'HOD'].includes(user.role);

  return (
    <nav
      aria-label="Main Navigation"
      className={cn(
        'w-full bg-white/95 backdrop-blur-md border-b border-border-subtle sticky top-16 z-20 shadow-2xs',
        className
      )}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none">
          {navLinks.map((link) => {
            if (link.roleRestricted && !isReviewer) return null;
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 select-none',
                  isActive
                    ? 'bg-primary text-white shadow-xs font-bold scale-[1.01]'
                    : 'text-text-muted hover:text-text-primary hover:bg-slate-100/80 active:scale-95'
                )}
              >
                <link.icon
                  size={15}
                  className={cn(
                    'shrink-0 transition-transform duration-150',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-text-primary',
                    link.isAi && !isActive && 'text-violet-500'
                  )}
                />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
