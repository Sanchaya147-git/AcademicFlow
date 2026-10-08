'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Audit } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AuditIcon } from '@/components/status-badge';
import { ShieldCheck, ClipboardList } from 'lucide-react';

export function AuditTimeline({ entries }: { entries: Audit[] }) {
  return (
    <Card className="border-border-subtle shadow-sm overflow-hidden">
      <CardHeader className="bg-background/50 border-b border-border-subtle pb-4 flex flex-row justify-between items-center">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" /> Decision timeline
        </CardTitle>
        <Badge variant="secondary" className="text-[10px]">{entries.length} records</Badge>
      </CardHeader>
      <CardContent className="p-0">
        {!entries.length ? (
          <div className="flex flex-col items-center justify-center p-16 text-text-muted">
            <ClipboardList size={32} className="mb-3 opacity-50" />
            <p className="text-sm">No audit events available in your scope.</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="relative border-l-2 border-border-subtle ml-3 space-y-6">
              {entries.map(a => (
                <details key={a.id} className="group relative pl-6">
                  <summary className="flex flex-col cursor-pointer outline-none list-none select-none">
                    <span className="timeline-dot absolute -left-[35px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center bg-blue-50 text-primary border-2 border-white shadow-xs">
                      <AuditIcon action={a.action} />
                    </span>
                    <div className="flex flex-wrap items-baseline gap-2 mb-1">
                      <strong className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                        {a.action.replaceAll('_',' ')}
                      </strong>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>{new Date(a.timestamp).toLocaleString()}</span>
                      <span className="w-1 h-1 rounded-full bg-border-subtle" />
                      <span className="font-medium text-text-primary">Actor: {a.performed_by}</span>
                    </div>
                  </summary>
                  <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle bg-sidebar">
                    <div className="flex items-center px-4 py-2 bg-sidebar/90 border-b border-white/10 text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                      Event Metadata
                    </div>
                    <pre className="p-4 text-[11px] font-mono text-gray-300 overflow-x-auto">
                      {JSON.stringify({ previous: a.previous_value, next: a.new_value, metadata: a.details }, null, 2)}
                    </pre>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AuditPage() {
  const [audit, setAudit] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAudit = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<Audit[]>('/audit');
      setAudit(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">Academic Intelligence</div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Trust & audit trail</h1>
        <p className="text-sm text-text-muted mt-1">Trace every decision back to its source and responsible actor.</p>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm flex gap-2">
          <span>{error}</span>
          <button onClick={fetchAudit} className="underline font-medium ml-auto">Retry loading</button>
        </div>
      )}

      {loading && !audit.length ? (
        <Card className="border-border-subtle shadow-sm overflow-hidden p-6 animate-in fade-in duration-300">
          <div className="relative border-l-2 border-border-subtle ml-3 space-y-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="relative pl-6 space-y-2">
                <span className="absolute -left-[35px] top-0 w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 border-2 border-white">
                  <Skeleton className="w-2.5 h-2.5 rounded-full" />
                </span>
                <Skeleton className="h-5 w-40 rounded-md" />
                <Skeleton className="h-3 w-56 rounded-md" />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <AuditTimeline entries={audit} />
      )}
    </div>
  );
}
