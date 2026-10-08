'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Analytics } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Charts } from '@/components/analytics-charts';
import { Skeleton } from '@/components/ui/skeleton';
import { CircleHelp } from 'lucide-react';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<Analytics>('/analytics/overview');
      setAnalytics(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">Academic Intelligence</div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Institutional intelligence</h1>
        <p className="text-sm text-text-muted mt-1">Evidence-based progress, with transparent sample sizes.</p>
      </div>
      
      {analytics?.demonstration_data && (
        <div className="p-4 bg-warning/10 border border-warning/20 text-warning rounded-xl text-sm flex gap-2 items-center">
          <CircleHelp size={16} />
          <span>Offline demonstration mode: deterministic extraction and lexical vectors, not live semantic AI.</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm flex gap-2">
          <span>{error}</span>
          <button onClick={fetchAnalytics} className="underline font-medium ml-auto">Retry loading</button>
        </div>
      )}

      {loading && !analytics ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="border-border-subtle shadow-sm p-6 space-y-3">
                <Skeleton className="h-3 w-28 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </Card>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-[340px] w-full rounded-2xl" />
            <Skeleton className="h-[340px] w-full rounded-2xl" />
          </div>
        </div>
      ) : analytics ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Planned executable sessions', analytics.planned_sessions], 
              ['Actual linked sessions', analytics.actual_sessions], 
              ['Mean duration (minutes)', analytics.average_actual_duration_minutes ?? 'No observations'], 
              ['Duration sample size', analytics.duration_sample_size]
            ].map(([key,value]) => (
              <Card key={String(key)} className="border-border-subtle shadow-sm bg-background/50">
                <CardContent className="p-6">
                  <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-2">{key}</span>
                  <strong className="text-2xl font-bold tracking-tight text-text-primary">{value}</strong>
                </CardContent>
              </Card>
            ))}
          </div>

          <Charts data={analytics} full={true} />
          
          <Card className="border-border-subtle shadow-sm overflow-hidden mt-6">
            <CardHeader className="bg-background/50 border-b border-border-subtle pb-4">
              <CardTitle className="text-base">Historical activity observations</CardTitle>
            </CardHeader>
            <div className="p-4 bg-info/5 text-info text-xs border-b border-info/10">
              Cross-semester averages are not fabricated. Repeated comparable cohorts are required before presenting a historical average.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-background text-text-muted text-[10px] uppercase tracking-wider font-semibold border-b border-border-subtle">
                  <tr>
                    <th className="px-6 py-4">Activity</th>
                    <th className="px-6 py-4">Planned sessions</th>
                    <th className="px-6 py-4">Observed sessions</th>
                    <th className="px-6 py-4">Sample size</th>
                    <th className="px-6 py-4">Historical mean</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-xs">
                  {analytics.historical_activity.map(a => (
                    <tr key={a.activity_id} className="hover:bg-background/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-primary">{a.name}</td>
                      <td className="px-6 py-4">{a.planned_sessions ?? '—'}</td>
                      <td className="px-6 py-4 font-bold text-success">{a.actual_sessions}</td>
                      <td className="px-6 py-4 text-text-muted">{a.sample_size}</td>
                      <td className="px-6 py-4 text-text-muted italic">Insufficient cohorts</td>
                    </tr>
                  ))}
                  {analytics.historical_activity.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-text-muted italic">No historical activities found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
