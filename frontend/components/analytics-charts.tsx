'use client';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { Analytics } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const pieColors = ['#E2E8F0', '#D97706', '#16A34A', '#94A3B8'];

export function Charts({ data, full = false }: { data: Analytics; full?: boolean }) {
  return (
    <div className="grid lg:grid-cols-2 xl:grid-cols-7 gap-6 mt-6">
      <Card className="xl:col-span-4 border-border-subtle shadow-sm flex flex-col">
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="text-base">Planned vs. completed</CardTitle>
          <CardDescription>Academic activities by department</CardDescription>
        </CardHeader>
        <CardContent className="p-6 h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.departments} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: 'var(--color-background)' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="planned" name="Planned" fill="#DBEAFE" radius={[4,4,0,0]} />
              <Bar dataKey="completed" name="Completed" fill="var(--color-primary)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card className="xl:col-span-3 border-border-subtle shadow-sm flex flex-col">
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="text-base">Activity status</CardTitle>
          <CardDescription>Live plan execution distribution</CardDescription>
        </CardHeader>
        <CardContent className="p-6 h-[300px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={data.status_distribution} 
                dataKey="value" 
                nameKey="name" 
                innerRadius={65} 
                outerRadius={95} 
                paddingAngle={3}
                stroke="none"
              >
                {data.status_distribution.map((item, i) => <Cell key={item.name} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {full && (
        <>
          <Card className="xl:col-span-3 border-border-subtle shadow-sm flex flex-col">
            <CardHeader className="border-b border-border-subtle pb-4">
              <CardTitle className="text-base">Course progress (%)</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.courses} layout="vertical" margin={{ left: 45, right: 20, top: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0,100]} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: 'var(--color-text-primary)' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'var(--color-background)' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}
                  />
                  <Bar dataKey="progress" fill="var(--color-success)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card className="xl:col-span-4 border-border-subtle shadow-sm flex flex-col">
            <CardHeader className="border-b border-border-subtle pb-4">
              <CardTitle className="text-base">Observed schedule variance (days)</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[300px] w-full">
              {data.schedule_variance.some(x => x.variance_days !== null) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.schedule_variance.filter(x => x.variance_days !== null).slice(0,12)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" hide />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'var(--color-background)' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}
                    />
                    <Bar dataKey="variance_days" fill="var(--color-warning)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-text-muted italic border border-dashed border-border-subtle rounded-xl bg-background/50">
                  No completed activities with actual dates yet. Variance is not estimated.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
