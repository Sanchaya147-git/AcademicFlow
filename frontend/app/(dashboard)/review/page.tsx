'use client';
import { FormEvent, useEffect, useState, useCallback } from 'react';
import { SearchCheck, ClipboardList, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api, post } from '@/lib/api';
import { Activity, Candidate, ReviewItem } from '@/types';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Resolution = { item: ReviewItem; kind: 'approve' | 'reject' | 'map' | 'classify'; candidate?: Candidate; classification?: string };

export default function ReviewPage() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [reason, setReason] = useState('');
  const [selection, setSelection] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => { setRevision(r => r + 1); }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api<ReviewItem[]>('/review/queue'), api<Activity[]>('/activities')])
      .then(([items, plan]) => {
        if (active) { setQueue(items); setActivities(plan); }
      })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const reviewer = user && ['ADMIN', 'COORDINATOR'].includes(user.role);

  function openResolution(value: Resolution) { 
    setResolution(value); 
    setReason(''); 
    setSelection(''); 
    setSearch(''); 
  }

  async function confirm(event: FormEvent) {
    event.preventDefault(); 
    if (!resolution) return;
    setBusy(true); 
    setError('');
    
    try {
      const { item, candidate, kind, classification } = resolution;
      if (kind === 'map') await post(`/review/${item.event.id}/manual-map`, { activity_id: selection, reason });
      else if (kind === 'classify') await post(`/review/${item.event.id}/classify`, { classification, reason });
      else await post(`/review/${candidate?.id}/${kind}`, { reason });
      
      setResolution(null); 
      setNotice('Decision recorded. Schedule and audit history are synchronized.'); 
      refresh();
    } catch (e) { 
      setError((e as Error).message); 
    } finally { 
      setBusy(false); 
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">Academic Intelligence</div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Human review queue</h1>
        <p className="text-sm text-text-muted mt-1">Your academic context. AI-assisted recommendations. Your decision.</p>
      </div>

      {notice && (
        <div className="p-4 bg-success/10 border border-success/20 text-success rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2"><CheckCircle2 size={16} /><span>{notice}</span></div>
          <button onClick={() => setNotice('')} className="hover:opacity-70">×</button>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm flex gap-2">
          <span>{error}</span>
          <button onClick={refresh} className="underline font-medium ml-auto">Retry loading</button>
        </div>
      )}

      {loading && !queue.length ? (
        <div className="p-12 text-center text-sm text-text-muted animate-pulse">Loading review queue…</div>
      ) : !queue.length ? (
        <div className="flex flex-col items-center justify-center p-20 text-text-muted border-2 border-dashed border-border-subtle rounded-2xl bg-background/50">
          <ClipboardList size={40} className="mb-4 opacity-50" />
          <p className="text-sm">All caught up. No events need human review.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {queue.map(item => (
            <Card key={item.event.id} className="border-border-subtle shadow-sm overflow-hidden border-t-4 border-t-warning">
              <CardHeader className="bg-background/50 border-b border-border-subtle pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-text-primary">{item.event.activity_description || 'Unspecified activity'}</CardTitle>
                  <p className="text-xs text-text-muted mt-1">{item.report.report_id} &middot; {item.event.event_date || 'Date not supplied'}</p>
                </div>
                <Badge variant="warning">{item.event.disposition.replaceAll('_', ' ')}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border-subtle">
                  <div className="p-6 bg-background/30">
                    <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-border-subtle text-text-primary flex items-center justify-center text-[10px]">01</span> Original evidence
                    </h3>
                    <blockquote className="text-sm leading-relaxed text-text-primary border-l-4 border-primary/40 pl-4 py-1 italic bg-background p-3 rounded-r-lg">
                      {item.event.source_excerpt || item.report.raw_content}
                    </blockquote>
                    <p className="text-[10px] text-text-muted mt-4">Preserved source text. Never rewritten by matching.</p>
                  </div>
                  
                  <div className="p-6 bg-background/30">
                    <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-border-subtle text-text-primary flex items-center justify-center text-[10px]">02</span> Extracted event
                    </h3>
                    <dl className="space-y-3">
                      {(['course','department','unit','class_section','faculty','event_date','status'] as const).map(key => (
                        <div key={key}>
                          <dt className="text-[10px] text-text-muted uppercase tracking-wider">{key.replaceAll('_',' ')}</dt>
                          <dd className="text-sm text-text-primary font-medium">{item.event[key] || 'Not provided'}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  
                  <div className="p-6 bg-background">
                    <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-primary text-white flex items-center justify-center text-[10px]">03</span> Candidate activities
                    </h3>
                    <div className="space-y-4">
                      {item.candidates.map(c => (
                        <div key={c.id} className="border border-border-subtle rounded-xl p-4 hover:border-primary/30 transition-colors bg-white">
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <strong className="text-sm font-bold text-text-primary line-clamp-2">{c.activity?.activity_name || 'No candidate found'}</strong>
                            <Badge variant={c.final_confidence >= 90 ? 'success' : c.final_confidence >= 50 ? 'warning' : 'destructive'} className="shrink-0">
                              {c.final_confidence.toFixed(1)}%
                            </Badge>
                          </div>
                          <p className="text-xs text-text-muted mb-2">
                            {c.activity ? `${c.activity.course} · ${c.activity.unit} · ${c.activity.class_section}` : 'Original event retained for review'}
                          </p>
                          <p className="text-[10px] bg-background text-text-primary p-2 rounded border border-border-subtle mb-4">{c.match_reason}</p>
                          
                          {reviewer && c.decision_type === 'PENDING' && (
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1" disabled={busy} onClick={() => openResolution({ item, candidate: c, kind: 'approve' })}>Approve</Button>
                              <Button size="sm" variant="outline" className="flex-1 hover:bg-danger/10 hover:text-danger hover:border-danger/30" disabled={busy} onClick={() => openResolution({ item, candidate: c, kind: 'reject' })}>Reject</Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
              {reviewer && (
                <CardFooter className="bg-background/80 border-t border-border-subtle p-4 flex flex-wrap items-center gap-3 justify-between">
                  <Button variant="secondary" size="sm" onClick={() => openResolution({ item, kind: 'map' })}>Manually map activity</Button>
                  <p className="text-xs text-text-muted flex items-center gap-2">
                    <ShieldCheck size={14} /> AI-assisted — review when uncertain
                  </p>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}

      {resolution && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader>
              <CardTitle>Confirm {resolution.kind === 'map' ? 'manual mapping' : resolution.classification?.replaceAll('_',' ').toLowerCase() || resolution.kind}</CardTitle>
              <p className="text-sm text-text-muted mt-2">This decision will be recorded with your identity and reason. Approving or mapping updates the official execution record.</p>
            </CardHeader>
            <CardContent>
              <form id="resolution-form" onSubmit={confirm} className="space-y-4">
                {resolution.kind === 'map' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Search master activities</label>
                      <input 
                        autoFocus 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder="Activity, course, or class" 
                        className="w-full rounded-md border border-border-subtle px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Select activity</label>
                      <select 
                        required 
                        value={selection} 
                        onChange={e => setSelection(e.target.value)}
                        className="w-full rounded-md border border-border-subtle px-3 py-2 text-sm"
                      >
                        <option value="">Choose an activity</option>
                        {activities.filter(a => `${a.activity_name} ${a.course} ${a.class_section}`.toLowerCase().includes(search.toLowerCase())).map(a => (
                          <option key={a.id} value={a.id}>{a.activity_name} · {a.course} · {a.class_section}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Reason (required)</label>
                  <textarea 
                    autoFocus={resolution.kind !== 'map'} 
                    required 
                    minLength={3} 
                    maxLength={2000} 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    rows={3}
                    className="w-full rounded-md border border-border-subtle px-3 py-2 text-sm"
                  />
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex justify-end gap-3 bg-background/50 border-t border-border-subtle p-4 rounded-b-xl">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setResolution(null)}>Cancel</Button>
              <Button type="submit" form="resolution-form" disabled={busy || reason.trim().length < 3}>
                {busy ? 'Saving…' : 'Confirm decision'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
