import {
  AlarmClock, Ban, CheckCircle2, CircleDashed, CircleHelp, Clock3,
  FileSpreadsheet, FileText, Link2, PlayCircle, ShieldCheck, UserCheck,
  XCircle, type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

const statusIcons: Record<string, LucideIcon> = {
  completed: CheckCircle2,
  linked: Link2,
  auto_link: Link2,
  auto_linked: Link2,
  human_confirmed: UserCheck,
  manually_mapped: UserCheck,
  human_review: Clock3,
  pending: Clock3,
  in_progress: PlayCircle,
  planned: CircleDashed,
  unmatched: CircleHelp,
  rejected: XCircle,
  cancelled: Ban,
  delayed: AlarmClock,
  text: FileText,
  spreadsheet: FileSpreadsheet,
  excel: FileSpreadsheet,
  xlsx: FileSpreadsheet,
};

const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  linked: 'bg-blue-50 text-blue-700 border-blue-200/80',
  auto_link: 'bg-blue-50 text-blue-700 border-blue-200/80',
  auto_linked: 'bg-blue-50 text-blue-700 border-blue-200/80',
  human_confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  manually_mapped: 'bg-teal-50 text-teal-700 border-teal-200/80',
  human_review: 'bg-amber-50 text-amber-800 border-amber-200/80',
  pending: 'bg-amber-50 text-amber-800 border-amber-200/80',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  planned: 'bg-slate-100 text-slate-700 border-slate-200/80',
  unmatched: 'bg-orange-50 text-orange-800 border-orange-200/80',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200/80',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200/80',
  delayed: 'bg-rose-50 text-rose-700 border-rose-200/80',
  text: 'bg-slate-100 text-slate-700 border-slate-200/80',
  spreadsheet: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  excel: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  xlsx: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const key = value.toLowerCase();
  const Icon = statusIcons[key];
  const colorStyle = statusStyles[key] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border shadow-2xs whitespace-nowrap uppercase tracking-wider',
        colorStyle
      )}
    >
      {Icon && <Icon size={12} className="shrink-0" aria-hidden />}
      <span>{label ?? value.replaceAll('_', ' ')}</span>
    </span>
  );
}

export function AuditIcon({ action }: { action: string }) {
  const a = action.toUpperCase();
  const Icon = a.includes('REJECT') ? XCircle : a.includes('APPROV') || a.includes('CONFIRM') ? CheckCircle2
    : a.includes('MAP') || a.includes('LINK') ? Link2 : a.includes('REPORT') || a.includes('INGEST') || a.includes('EXTRACT') ? FileText
    : a.includes('CLASSIF') ? CircleHelp : ShieldCheck;
  return <Icon size={11} aria-hidden />;
}
