import { AlarmClock, Ban, CheckCircle2, CircleDashed, CircleHelp, Clock3, FileSpreadsheet, FileText, Link2, PlayCircle, ShieldCheck, UserCheck, XCircle, type LucideIcon } from 'lucide-react';

const statusIcons: Record<string, LucideIcon> = {
  completed: CheckCircle2, linked: Link2, auto_link: Link2, auto_linked: Link2, human_confirmed: UserCheck, manually_mapped: UserCheck,
  human_review: Clock3, pending: Clock3, in_progress: PlayCircle, planned: CircleDashed,
  unmatched: CircleHelp, rejected: XCircle, cancelled: Ban, delayed: AlarmClock,
  text: FileText, spreadsheet: FileSpreadsheet, excel: FileSpreadsheet, xlsx: FileSpreadsheet,
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const key = value.toLowerCase();
  const Icon = statusIcons[key];
  return <span className={`badge ${key}`}>{Icon && <Icon size={11} aria-hidden />}{label ?? value.replaceAll('_', ' ')}</span>;
}

export function AuditIcon({ action }: { action: string }) {
  const a = action.toUpperCase();
  const Icon = a.includes('REJECT') ? XCircle : a.includes('APPROV') || a.includes('CONFIRM') ? CheckCircle2
    : a.includes('MAP') || a.includes('LINK') ? Link2 : a.includes('REPORT') || a.includes('INGEST') || a.includes('EXTRACT') ? FileText
    : a.includes('CLASSIF') ? CircleHelp : ShieldCheck;
  return <Icon size={11} aria-hidden />;
}
