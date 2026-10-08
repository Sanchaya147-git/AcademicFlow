'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Activity } from '@/types';
import { ActivityTable } from '@/components/activity-table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function SchedulePage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [department, setDepartment] = useState('');
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState('');
  const [classSection, setClassSection] = useState('');
  const [planDate, setPlanDate] = useState('');

  const fetchActivities = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<Activity[]>('/activities');
      setActivities(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const filtered = activities.filter(a => 
    (!department || a.department === department) && 
    (!course || a.course === course) && 
    (!status || a.status === status) && 
    (!classSection || a.class_section === classSection) && 
    (!planDate || (a.planned_start <= planDate && a.planned_end >= planDate))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 flex flex-col">
      <div className="shrink-0 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">Academic Intelligence</div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Academic schedule</h1>
          <p className="text-sm text-text-muted mt-1">Compare planned dates with verified actual execution.</p>
        </div>
      </div>
      
      {error && (
        <div className="shrink-0 p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm flex gap-2">
          <span>{error}</span>
          <button onClick={fetchActivities} className="underline font-medium ml-auto">Retry loading</button>
        </div>
      )}

      {loading && !activities.length ? (
        <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-xs flex flex-col space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-wrap gap-3 pb-3 border-b border-border-subtle">
            <Skeleton className="h-9 w-36 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex items-center justify-between gap-4 py-3 border-b border-border-subtle/60">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-1/3 rounded-md" />
                  <Skeleton className="h-3 w-1/5 rounded-md" />
                </div>
                <Skeleton className="h-4 w-20 rounded-md hidden sm:block" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="shrink-0 flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-border-subtle shadow-xs">
            <select aria-label="Department" value={department} onChange={e => setDepartment(e.target.value)} className="h-9 rounded-xl border border-border-subtle px-3 py-1 text-xs text-text-primary bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[150px] transition-all">
              <option value="">All departments</option>
              {[...new Set(activities.map(a => a.department))].map(v => <option key={v}>{v}</option>)}
            </select>
            <select aria-label="Course" value={course} onChange={e => setCourse(e.target.value)} className="h-9 rounded-xl border border-border-subtle px-3 py-1 text-xs text-text-primary bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[150px] transition-all">
              <option value="">All courses</option>
              {[...new Set(activities.map(a => a.course))].map(v => <option key={v}>{v}</option>)}
            </select>
            <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} className="h-9 rounded-xl border border-border-subtle px-3 py-1 text-xs text-text-primary bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[150px] transition-all">
              <option value="">All statuses</option>
              {['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'].map(v => <option key={v}>{v}</option>)}
            </select>
            <select aria-label="Class section" value={classSection} onChange={e => setClassSection(e.target.value)} className="h-9 rounded-xl border border-border-subtle px-3 py-1 text-xs text-text-primary bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[150px] transition-all">
              <option value="">All classes</option>
              {[...new Set(activities.map(a => a.class_section))].map(v => <option key={v}>{v}</option>)}
            </select>
            <input aria-label="Planned date" type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className="h-9 rounded-xl border border-border-subtle px-3 py-1 text-xs text-text-primary bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[150px] transition-all" />
            <Button variant="ghost" size="sm" className="h-9 text-text-muted hover:text-text-primary ml-auto rounded-xl" onClick={() => { setDepartment(''); setCourse(''); setStatus(''); setClassSection(''); setPlanDate(''); }}>
              Clear filters
            </Button>
          </div>
          
          <div>
            <ActivityTable data={filtered} schedule={true} />
          </div>
        </div>
      )}
    </div>
  );
}
