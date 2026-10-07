'use client';
import { FormEvent, useEffect, useState, useCallback } from 'react';
import { FileText, Upload, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api, post } from '@/lib/api';
import { Report, Event as ExecutionEvent, Candidate } from '@/types';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pipeline, setPipeline] = useState<{ event_id: string; decision: string; candidates: Candidate[] }[]>([]);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => { setRevision(r => r + 1); }, []);

  useEffect(() => {
    let active = true;
    api<Report[]>('/reports')
      .then(value => { if (active) setReports(value); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  async function processReport(reportId: string) {
    setNotice('Report preserved. Extracting structured evidence…');
    const events = await post<ExecutionEvent[]>(`/extraction/${reportId}`);
    const outcomes = [];
    for (const event of events) {
      setNotice(`Matching event ${outcomes.length + 1} of ${events.length}…`);
      outcomes.push(await post<{ event_id: string; decision: string; candidates: Candidate[] }>(`/matching/${event.id}`));
    }
    setPipeline(outcomes);
    setNotice(`Processed ${events.length} event(s). Review the source-backed decisions below.`);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); 
    const form = event.currentTarget;
    setBusy(true); 
    setError(''); 
    setPipeline([]);
    const data = new FormData(form);
    
    try {
      const result = await post<{ report_id: string }>('/reports/text', { content: data.get('content') });
      await processReport(result.report_id); 
      form.reset(); 
      refresh();
    } catch (e) { 
      setError((e as Error).message); 
      setNotice('If ingestion succeeded, the original report remains saved. Retry processing from its report row.'); 
      refresh(); 
    } finally { 
      setBusy(false); 
    }
  }

  async function uploadSpreadsheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); 
    setBusy(true); 
    setError(''); 
    setPipeline([]);
    const data = new FormData(event.currentTarget);
    
    try {
      const result = await api<{ report_id: string; processed_rows: number; failed_rows: number; errors: unknown[] }>('/reports/spreadsheet', { method: 'POST', body: data });
      setNotice(`${result.processed_rows} valid rows, ${result.failed_rows} failed rows. Details are preserved on the report.`);
      await processReport(result.report_id); 
      refresh();
    } catch (e) { 
      setError((e as Error).message); 
    } finally { 
      setBusy(false); 
    }
  }

  async function resume(reportId: string) {
    setBusy(true); 
    setError('');
    try { 
      await processReport(reportId); 
      refresh(); 
    } catch (e) { 
      setError((e as Error).message); 
    } finally { 
      setBusy(false); 
    }
  }

  const submitter = user && user.role !== 'HOD';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">Academic Intelligence</div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Faculty reports</h1>
        <p className="text-sm text-text-muted mt-1">Capture academic execution from natural language or spreadsheets.</p>
      </div>

      {notice && (
        <div className="p-4 bg-success/10 border border-success/20 text-success rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice('')} className="hover:opacity-70">×</button>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm flex gap-2">
          <span>{error}</span>
          <button onClick={refresh} className="underline font-medium ml-auto">Retry loading</button>
        </div>
      )}

      {submitter && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-border-subtle shadow-sm">
            <CardHeader className="border-b border-border-subtle pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={18} className="text-primary" /> Free-text report
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={submitReport} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-primary">What academic activity did you complete?</label>
                  <textarea 
                    name="content" 
                    required 
                    minLength={3} 
                    maxLength={20000} 
                    rows={5} 
                    placeholder="Completed DBMS normalization for CSE-C today. Include course, class, and dates when known."
                    className="w-full rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  />
                </div>
                <p className="text-xs text-text-muted">Submitting as <span className="font-medium text-text-primary">{user.email}</span>. Only source-supported information is extracted.</p>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? 'Processing…' : 'Submit & process report'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border-subtle shadow-sm">
            <CardHeader className="border-b border-border-subtle pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload size={18} className="text-primary" /> Spreadsheet ingestion
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={uploadSpreadsheet} className="space-y-6">
                <div className="border-2 border-dashed border-border-subtle rounded-xl p-8 text-center bg-background/50 hover:bg-background transition-colors">
                  <div className="flex flex-col items-center justify-center space-y-2 text-primary mb-4">
                    <Upload size={32} />
                    <strong className="text-sm text-text-primary">Upload faculty execution reports</strong>
                    <p className="text-xs text-text-muted">.xlsx only &middot; up to 5 MB &middot; 5,000 rows</p>
                  </div>
                  <input name="file" type="file" accept=".xlsx" required className="w-full max-w-xs mx-auto text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                </div>
                <p className="text-xs text-text-muted text-center">Varying column names, row errors, and source evidence are preserved.</p>
                <Button type="submit" variant="outline" disabled={busy} className="w-full">
                  Upload & process
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {pipeline.length > 0 && (
        <Card className="border-border-subtle shadow-sm border-t-4 border-t-primary">
          <CardHeader className="border-b border-border-subtle pb-4">
            <CardTitle className="text-base">Processing results</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-6">
              {pipeline.map(p => (
                <div key={p.event_id} className="space-y-3">
                  <Badge variant={p.decision === 'AUTO_LINKED' ? 'success' : p.decision === 'HUMAN_REVIEW' ? 'warning' : 'destructive'} className="text-[10px]">
                    {p.decision.replaceAll('_', ' ')}
                  </Badge>
                  <div className="grid lg:grid-cols-3 gap-4">
                    {p.candidates.slice(0,3).map(c => (
                      <div key={c.id} className="border border-border-subtle rounded-lg p-4 bg-background">
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <strong className="text-sm font-semibold text-text-primary line-clamp-2">{c.activity?.activity_name || 'No candidate found'}</strong>
                          <span className={`text-sm font-bold ${c.final_confidence >= 90 ? 'text-success' : c.final_confidence >= 50 ? 'text-warning' : 'text-danger'}`}>
                            {c.final_confidence.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mb-2">
                          {c.activity ? `${c.activity.course} · ${c.activity.unit} · ${c.activity.class_section}` : 'Original event retained for review'}
                        </p>
                        <p className="text-[10px] text-text-primary bg-background border border-border-subtle p-2 rounded">{c.match_reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border-subtle shadow-sm">
        <CardHeader className="border-b border-border-subtle pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Report history</CardTitle>
          <Badge variant="secondary" className="text-[10px]">{reports.length} reports loaded</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !reports.length ? (
            <div className="p-12 text-center text-sm text-text-muted">Loading reports…</div>
          ) : !reports.length ? (
            <div className="p-16 text-center text-text-muted flex flex-col items-center gap-3">
              <FileText size={32} className="opacity-50" />
              <p className="text-sm">No reports yet. Submit the first faculty report above.</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {reports.map(r => (
                <details key={r.id} className="group">
                  <summary className="flex flex-wrap items-center gap-4 p-5 cursor-pointer hover:bg-background/50 text-sm list-none select-none">
                    <FileText size={16} className="text-primary shrink-0" />
                    <strong className="text-text-primary font-mono text-xs">{r.report_id}</strong>
                    <Badge variant="outline" className="text-[9px] bg-background">{r.source_type}</Badge>
                    <span className="text-text-muted text-xs ml-auto hidden sm:inline-block">{new Date(r.submitted_at).toLocaleString()}</span>
                    <Badge variant="secondary" className="text-[9px]">{r.events.length} events</Badge>
                  </summary>
                  <div className="p-5 pt-0 border-t border-border-subtle bg-background/30">
                    <div className="my-4 space-x-2">
                      {r.events.map(e => (
                        <Badge key={e.id} variant={e.disposition === 'COMPLETED' ? 'success' : e.disposition === 'UNMATCHED' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {e.disposition}
                        </Badge>
                      ))}
                    </div>
                    <pre className="text-[10px] bg-background border border-border-subtle p-4 rounded-lg overflow-auto max-h-60 text-text-muted mb-4 whitespace-pre-wrap">
                      {r.raw_content}
                    </pre>
                    {r.file_metadata && (
                      <pre className="text-[10px] bg-sidebar text-gray-300 p-4 rounded-lg overflow-auto max-h-40 mb-4">
                        {JSON.stringify(r.file_metadata, null, 2)}
                      </pre>
                    )}
                    {submitter && (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => resume(r.report_id)}>
                        Process / retry safely
                      </Button>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
