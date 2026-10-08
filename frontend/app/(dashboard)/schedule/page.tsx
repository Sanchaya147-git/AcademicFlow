'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Activity } from '@/types';
import { ActivityTable } from '@/components/activity-table';
import { Button } from '@/components/ui/button';

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
    <div className="space-y-6 animate-in fade-in duration-500 flex flex-col h-[calc(100vh-6rem)]">
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
        <div className="p-12 text-center text-sm text-text-muted animate-pulse">Loading schedule…</div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-6">
          <div className="shrink-0 flex flex-wrap gap-3 bg-background/50 p-4 rounded-xl border border-border-subtle">
            <select aria-label="Department" value={department} onChange={e => setDepartment(e.target.value)} className="h-9 rounded-md border border-border-subtle px-3 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary min-w-[150px]">
              <option value="">All departments</option>
              {[...new Set(activities.map(a => a.department))].map(v => <option key={v}>{v}</option>)}
            </select>
            <select aria-label="Course" value={course} onChange={e => setCourse(e.target.value)} className="h-9 rounded-md border border-border-subtle px-3 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary min-w-[150px]">
              <option value="">All courses</option>
              {[...new Set(activities.map(a => a.course))].map(v => <option key={v}>{v}</option>)}
            </select>
            <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} className="h-9 rounded-md border border-border-subtle px-3 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary min-w-[150px]">
              <option value="">All statuses</option>
              {['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'].map(v => <option key={v}>{v}</option>)}
            </select>
            <select aria-label="Class section" value={classSection} onChange={e => setClassSection(e.target.value)} className="h-9 rounded-md border border-border-subtle px-3 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary min-w-[150px]">
              <option value="">All classes</option>
              {[...new Set(activities.map(a => a.class_section))].map(v => <option key={v}>{v}</option>)}
            </select>
            <input aria-label="Planned date" type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className="h-9 rounded-md border border-border-subtle px-3 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary min-w-[150px]" />
            <Button variant="ghost" size="sm" className="h-9 text-text-muted hover:text-text-primary ml-auto" onClick={() => { setDepartment(''); setCourse(''); setStatus(''); setClassSection(''); setPlanDate(''); }}>
              Clear filters
            </Button>
          </div>
          
          <div className="flex-1 min-h-0">
            <ActivityTable data={filtered} schedule={true} />
          </div>
        </div>
      )}
    </div>
  );
}
