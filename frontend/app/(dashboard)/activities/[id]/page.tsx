'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Activity, Audit, ReviewItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuditTimeline } from '@/app/(dashboard)/audit/page';
import { use } from 'react';
import { ClipboardList, GraduationCap, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [detail, setDetail] = useState<{ activity: Activity; executions: ReviewItem[]; audit: Audit[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ activity: Activity; executions: ReviewItem[]; audit: Audit[] }>(`/activities/${id}`);
      setDetail(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div>
        <Link href="/activities" className={buttonVariants({ variant: 'ghost', size: 'sm', className: "mb-6 -ml-3 text-text-muted hover:text-text-primary" })}>
          <ChevronLeft size={16} className="mr-1" /> Back to Master Plan
        </Link>
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">Activity Detail</div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">{detail?.activity.activity_name || 'Loading details...'}</h1>
        <p className="text-sm text-text-muted mt-1">Plan, execution evidence, and decision history in one place.</p>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm flex gap-2">
          <span>{error}</span>
          <button onClick={fetchDetail} className="underline font-medium ml-auto">Retry loading</button>
        </div>
      )}

      {loading && !detail ? (
        <div className="p-12 text-center text-sm text-text-muted animate-pulse">Loading activity details…</div>
      ) : detail ? (
        <>
          <Card className="border-border-subtle shadow-sm overflow-hidden border-t-4 border-t-primary">
            <CardHeader className="bg-background/50 border-b border-border-subtle pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <GraduationCap size={20} className="text-primary" /> {detail.activity.activity_id}
              </CardTitle>
              <Badge variant={detail.activity.status === 'COMPLETED' ? 'success' : detail.activity.status === 'IN_PROGRESS' ? 'warning' : 'secondary'} className="text-[10px] uppercase tracking-widest">
                {detail.activity.status.replaceAll('_', ' ')}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:gap-x-6 sm:gap-y-8 p-6">
                {Object.entries(detail.activity).filter(([key]) => !['id','activity_id','is_demo'].includes(key)).map(([key,value]) => (
                  <div key={key} className="py-3 sm:py-0">
                    <dt className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{key.replaceAll('_',' ')}</dt>
                    <dd className="text-sm font-medium text-text-primary">{String(value ?? 'Not supplied')}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card className="border-border-subtle shadow-sm overflow-hidden">
            <CardHeader className="bg-background/50 border-b border-border-subtle pb-4">
              <CardTitle className="text-base">Linked execution evidence</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {detail.executions.length ? (
                <div className="divide-y divide-border-subtle">
                  {detail.executions.map(item => (
                    <div className="p-6 bg-background/30" key={item.event.id}>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-text-muted font-mono">{item.report.report_id}</p>
                        <Badge variant="secondary" className="text-[10px]">{item.event.event_date || 'No source date'}</Badge>
                      </div>
                      
                      <blockquote className="text-sm leading-relaxed text-text-primary border-l-4 border-primary/40 pl-4 py-1 italic bg-background p-3 rounded-r-lg mb-6">
                        {item.event.source_excerpt}
                      </blockquote>
                      
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Matches</h4>
                        <div className="grid sm:grid-cols-2 gap-4">
                          {item.candidates.filter(c => ['AUTO_LINKED','HUMAN_CONFIRMED','MANUALLY_MAPPED'].includes(c.decision_type)).map(c => (
                            <div key={c.id} className="border border-border-subtle rounded-xl p-4 bg-white">
                              <div className="flex justify-between items-start gap-4 mb-2">
                                <strong className="text-sm font-bold text-text-primary line-clamp-2">{c.activity?.activity_name || 'No candidate found'}</strong>
                                <Badge variant="success" className="shrink-0">{c.final_confidence.toFixed(1)}%</Badge>
                              </div>
                              <p className="text-[10px] bg-background text-text-primary p-2 rounded border border-border-subtle mt-2 mb-2">{c.match_reason}</p>
                              <p className="text-[9px] text-text-muted uppercase">{c.decision_type.replaceAll('_', ' ')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-16 text-text-muted">
                  <ClipboardList size={32} className="mb-3 opacity-50" />
                  <p className="text-sm">No confirmed executions yet.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <AuditTimeline entries={detail.audit} />
        </>
      ) : null}
    </div>
  );
}
