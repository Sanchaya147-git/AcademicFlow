'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, FileText, CheckSquare, TrendingUp,
  Upload, ArrowRight, Clock, Sparkles,
  CalendarDays, Activity, ChevronRight, Star,
  Link2, SearchCheck, CircleHelp, CheckCircle2, AlarmClock, ShieldCheck,
  type LucideIcon
} from 'lucide-react';
import { api } from '@/lib/api';
import { Analytics } from '@/types';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Charts } from '@/components/analytics-charts';
import { Skeleton } from '@/components/ui/skeleton';
import { CountUp, Bar } from '@/components/motion';

// ─── Metric card data ─────────────────────────────────────────────────────────
const STATIC_METRICS = [
  {
    label: 'My Courses',
    value: '6',
    sub: 'Current Semester',
    icon: BookOpen,
    accent: 'blue' as const,
  },
  {
    label: 'Reports Submitted',
    value: '4 / 6',
    sub: 'This Semester',
    icon: FileText,
    accent: 'violet' as const,
  },
  {
    label: 'Tasks Pending',
    value: '3',
    sub: 'Action Required',
    icon: CheckSquare,
    accent: 'pink' as const,
  },
  {
    label: 'Overall Progress',
    value: '72%',
    sub: 'On Track',
    icon: TrendingUp,
    accent: 'cyan' as const,
  },
];

const ACCENT_STYLES: Record<string, { bg: string; icon: string; bar: string }> = {
  blue:   { bg: 'bg-accent-blue',   icon: 'text-blue-500',   bar: 'bg-blue-400' },
  violet: { bg: 'bg-accent-violet', icon: 'text-violet-500', bar: 'bg-violet-400' },
  pink:   { bg: 'bg-accent-pink',   icon: 'text-pink-500',   bar: 'bg-pink-400' },
  cyan:   { bg: 'bg-accent-cyan',   icon: 'text-cyan-500',   bar: 'bg-cyan-400' },
};

const metricIcons: Record<string, [LucideIcon, string]> = {
  reports_today: [FileText, ''],
  auto_linked: [Link2, 'success'],
  needs_review: [SearchCheck, 'warning'],
  unmatched: [CircleHelp, 'danger'],
  activities_completed: [CheckCircle2, 'success'],
  delayed_activities: [AlarmClock, 'warning'],
  schedule_health: [Activity, ''],
};

function MetricIcon({ name }: { name: string }) {
  const [Icon, tone] = metricIcons[name] ?? [Clock, ''];
  return <span className={`icon-chip${tone ? ` ${tone}` : ''}`} aria-hidden><Icon size={16} /></span>;
}

// ─── Upcoming deadlines (static demo — replace with real API when available) ──
const UPCOMING_DEADLINES = [
  { label: 'Mid-Term Activity Report',   due: 'Sep 22',  status: 'urgent',  course: 'CS401' },
  { label: 'Lab Session Documentation',  due: 'Sep 25',  status: 'pending', course: 'CS312' },
  { label: 'Faculty Review Submission',  due: 'Sep 30',  status: 'pending', course: 'MATH201' },
];

// ─── AI Insights (static demo — replace with AI API when available) ───────────
const AI_INSIGHTS = [
  {
    title: 'Complete 2 pending reports',
    desc: 'You are 2 reports away from 100% semester completion.',
    icon: Star,
    color: 'text-violet-500',
    bg: 'bg-accent-violet',
  },
  {
    title: 'Lab sessions below average',
    desc: 'CS312 lab attendance is 15% below department average.',
    icon: Activity,
    color: 'text-pink-500',
    bg: 'bg-accent-pink',
  },
  {
    title: 'High performer: CS401',
    desc: 'CS401 is 95% complete — ahead of schedule by 3 days.',
    icon: TrendingUp,
    color: 'text-blue-500',
    bg: 'bg-accent-blue',
  },
];

// ─── Recent activity (static demo — replace with real API when available) ─────
const RECENT_ACTIVITY = [
  { action: 'Report submitted',      detail: 'CS401 Mid-Semester Report',    time: '2h ago',   color: 'bg-blue-400' },
  { action: 'Activity auto-matched', detail: 'Lab Session #4 linked',         time: '5h ago',   color: 'bg-violet-400' },
  { action: 'Review approved',       detail: 'MATH201 Tutorial confirmed',    time: 'Yesterday', color: 'bg-green-400' },
  { action: 'Report flagged',        detail: 'CS312 report needs revision',   time: 'Yesterday', color: 'bg-pink-400' },
];

// ─── Greeting helper ──────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api<Analytics>('/analytics/overview')
      .then(value => { if (active) setAnalytics(value); })
      .catch(e   => { if (active) setError(e.message);  })
      .finally(()=> { if (active) setLoading(false);    });
    return () => { active = false; };
  }, []);

  const submitter = user && user.role !== 'HOD';
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">

      {/* ── Welcome banner ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">
            {getGreeting()}, {firstName}! 👋
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Stay consistent. Progress leads to possibilities.
          </p>
        </div>

        {submitter && (
          <Link
            href="/reports"
            className={buttonVariants({ className: 'shrink-0 shadow-sm' })}
          >
            <Upload size={15} className="mr-2" /> Submit Report
          </Link>
        )}
      </div>

      {/* ── API error ───────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm">
          {error}{' '}
          <button onClick={() => window.location.reload()} className="underline ml-2 font-medium">
            Retry
          </button>
        </div>
      )}

      {/* ── Metric cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {analytics?.summary ? (
          Object.entries(analytics.summary).map(([key, value], index) => (
            <Card 
              key={key} 
              className={`border-border-subtle shadow-2xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 group cursor-default enter-up ${
                key === 'auto_linked' ? 'border-b-2 border-b-emerald-500' : key === 'needs_review' ? 'border-b-2 border-b-amber-500' : key === 'unmatched' ? 'border-b-2 border-b-rose-500' : ''
              }`}
              style={{ '--i': index } as React.CSSProperties}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted truncate mr-1">
                    {key.replaceAll('_', ' ')}
                  </span>
                  <MetricIcon name={key} />
                </div>
                <div className="text-2xl font-extrabold text-text-primary tracking-tight">
                  <CountUp id={key} value={value} suffix={key === 'schedule_health' ? '%' : ''} />
                </div>
                <div className="text-[10px] text-text-muted mt-1 truncate">
                  {key === 'schedule_health' ? 'Health metric' : 'Institutional records'}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          STATIC_METRICS.map(m => {
            const s = ACCENT_STYLES[m.accent];
            return (
              <Card key={m.label} className="border-border-subtle shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 group cursor-default">
                <CardContent className="p-4">
                  <div className={`inline-flex p-2 rounded-xl ${s.bg} mb-3 group-hover:scale-110 transition-transform duration-200`}>
                    <m.icon size={16} className={s.icon} />
                  </div>
                  <div className="text-2xl font-extrabold text-text-primary tracking-tight">{m.value}</div>
                  <div className="text-xs font-semibold text-text-primary mt-0.5">{m.label}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">{m.sub}</div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ── Main content grid ────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left column: Semester Progress + AI Insights */}
        <div className="lg:col-span-2 space-y-6">

          {/* Semester Progress */}
          <Card className="border-border-subtle shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-text-primary">Semester Progress</CardTitle>
              <Link href="/analytics" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 group">
                View Analytics <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </CardHeader>
            <CardContent>
              {loading && !analytics ? (
                <div className="space-y-4 py-2 animate-in fade-in duration-300">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-4 w-28 rounded-md" />
                        <Skeleton className="h-4 w-16 rounded-md" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : analytics ? (
                <>
                  {analytics.demonstration_data && (
                    <p className="text-[10px] uppercase tracking-wide text-text-muted font-bold mb-4">
                      Synthetic master plan · execution values from submitted reports
                    </p>
                  )}
                  {/* Compact department progress bars */}
                  <div className="space-y-3">
                    {analytics.departments.slice(0, 5).map((d, i) => (
                      <div key={d.name}>
                        <div className="flex items-center justify-between mb-1.5 text-sm">
                          <span className="font-semibold text-text-primary text-xs">{d.name}</span>
                          <div className="flex items-center gap-3 text-[11px] text-text-muted">
                            <span>{d.completed} / {d.planned}</span>
                            <span className="font-bold text-text-primary w-8 text-right">{d.progress}%</span>
                          </div>
                        </div>
                        <Bar value={d.progress} index={i} label={`${d.name} progress`} />
                      </div>
                    ))}
                  </div>

                  {/* Charts */}
                  <div className="mt-6">
                    <Charts data={analytics} full={false} />
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* AI Recommendations / Insights */}
          <Card className="border-border-subtle shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-text-primary flex items-center gap-2">
                <Sparkles size={16} className="text-violet-500" /> AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {AI_INSIGHTS.map(insight => (
                <div key={insight.title} className={`flex gap-3 p-3 rounded-xl ${insight.bg}/50 border border-border-subtle`}>
                  <div className={`shrink-0 mt-0.5 ${insight.color}`}>
                    <insight.icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{insight.title}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{insight.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Upcoming Deadlines + Recent Activity + Quick Actions */}
        <div className="space-y-6">

          {/* Upcoming Deadlines */}
          <Card className="border-border-subtle shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-text-primary flex items-center gap-2">
                <CalendarDays size={15} className="text-blue-500" /> Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border-subtle">
                {UPCOMING_DEADLINES.map(d => (
                  <div key={d.label} className="flex items-start gap-3 p-4 hover:bg-accent-blue/20 transition-colors">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${d.status === 'urgent' ? 'bg-danger' : 'bg-warning'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{d.label}</p>
                      <p className="text-[11px] text-text-muted">{d.course}</p>
                    </div>
                    <Badge
                      variant={d.status === 'urgent' ? 'destructive' : 'secondary'}
                      className="text-[10px] shrink-0"
                    >
                      {d.due}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-border-subtle shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-text-primary flex items-center gap-2">
                <Activity size={15} className="text-violet-500" /> Recent Activity
              </CardTitle>
              <Link href="/audit" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                View all <ChevronRight size={13} />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border-subtle">
                {RECENT_ACTIVITY.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 hover:bg-accent-violet/20 transition-colors">
                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-primary">{item.action}</p>
                      <p className="text-[11px] text-text-muted truncate">{item.detail}</p>
                    </div>
                    <span className="text-[11px] text-text-muted shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border-subtle shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-text-primary flex items-center gap-2">
                <Clock size={15} className="text-pink-500" /> Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: '/reports',    label: 'Submit Report',         icon: Upload,       accent: 'text-blue-500',   bg: 'bg-accent-blue' },
                { href: '/activities', label: 'View My Plan',          icon: BookOpen,     accent: 'text-violet-500', bg: 'bg-accent-violet' },
                { href: '/review',     label: 'Review AI Matches',     icon: Sparkles,     accent: 'text-pink-500',   bg: 'bg-accent-pink' },
                { href: '/analytics',  label: 'Explore Analytics',     icon: TrendingUp,   accent: 'text-cyan-500',   bg: 'bg-accent-cyan' },
              ].map(action => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border-subtle hover:border-primary/30 hover:bg-primary-light/30 transition-colors group"
                >
                  <div className={`p-2 rounded-lg ${action.bg}`}>
                    <action.icon size={15} className={action.accent} />
                  </div>
                  <span className="text-sm font-medium text-text-primary flex-1">{action.label}</span>
                  <ArrowRight size={14} className="text-text-muted group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Transparent by Design Trust Card */}
          <Card className="border-border-subtle shadow-sm bg-gradient-to-br from-blue-50/50 via-white to-slate-50/50">
            <CardContent className="p-5 space-y-3">
              <span className="icon-chip lg" aria-hidden>
                <ShieldCheck size={22} />
              </span>
              <h2 className="text-sm font-bold text-text-primary">Transparent by design</h2>
              <p className="text-xs text-text-muted leading-relaxed">
                Source reports are preserved. Missing evidence stays missing. Uncertain matches require a person, not a guess.
              </p>
              <Link href="/audit" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                Explore the audit trail <ArrowRight size={14} />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
