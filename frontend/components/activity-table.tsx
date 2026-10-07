'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table';
import { Activity } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export function ActivityTable({ data, schedule = false }: { data: Activity[]; schedule?: boolean }) {
  'use no memo'; // TanStack Table exposes mutable instance functions; do not compiler-memoize.
  
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const columns = useMemo<ColumnDef<Activity>[]>(() => [
    { 
      accessorKey: 'activity_name', 
      header: 'Academic activity', 
      cell: ({ row }) => (
        <Link className="block group min-w-[200px]" href={`/activities/${row.original.id}`}>
          <strong className="text-text-primary group-hover:text-primary transition-colors block text-sm font-semibold">{row.original.activity_name}</strong>
          <small className="text-[10px] text-text-muted mt-1 block font-mono">{row.original.activity_id}</small>
        </Link>
      ) 
    },
    { accessorKey: 'department', header: 'Dept.' },
    { accessorKey: 'course', header: 'Course' },
    { accessorKey: 'class_section', header: 'Class' },
    { accessorKey: 'planned_end', header: 'Planned end' },
    { accessorKey: 'actual_end', header: 'Actual end', cell: ({ getValue }) => String(getValue() || '—') },
    { 
      accessorKey: 'status', 
      header: 'Status', 
      cell: ({ getValue }) => {
        const status = String(getValue());
        const variant = status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : 'secondary';
        return <Badge variant={variant} className="text-[9px] uppercase tracking-wider">{status.replaceAll('_', ' ')}</Badge>
      } 
    },
    ...(schedule ? [{ 
      id: 'variance', 
      header: 'Variance', 
      cell: ({ row }: { row: { original: Activity } }) => {
        if (!row.original.actual_end) return <span className="text-text-muted italic">Not yet known</span>;
        const days = Math.round((Date.parse(row.original.actual_end) - Date.parse(row.original.planned_end)) / 86400000);
        return (
          <Badge variant={days > 0 ? 'destructive' : days < 0 ? 'success' : 'secondary'} className="text-[10px]">
            {days > 0 ? `+${days} days (Late)` : days < 0 ? `${days} days (Early)` : 'On time'}
          </Badge>
        );
      } 
    }] : [
      { 
        accessorKey: 'completion_percentage', 
        header: 'Progress', 
        cell: ({ row }: { row: { original: Activity } }) => (
          <div className="flex items-center gap-3 min-w-[120px]">
            <div className="w-full bg-border-subtle rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${row.original.completion_percentage}%` }} 
              />
            </div>
            <span className="text-[10px] font-bold text-text-muted w-8">{row.original.completion_percentage}%</span>
          </div>
        ) 
      },
    ]),
  ], [schedule]);
  
  const table = useReactTable({ 
    data, 
    columns, 
    state: { globalFilter: search, sorting }, 
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting, 
    getCoreRowModel: getCoreRowModel(), 
    getFilteredRowModel: getFilteredRowModel(), 
    getSortedRowModel: getSortedRowModel() 
  });
  
  return (
    <Card className="border-border-subtle shadow-sm flex flex-col h-full overflow-hidden">
      <CardHeader className="bg-background border-b border-border-subtle pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <CardTitle className="text-base">{schedule ? 'Execution schedule' : 'Master academic plan'}</CardTitle>
        <div className="relative max-w-sm w-full sm:w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted h-4 w-4" />
          <Input 
            aria-label="Search activities" 
            placeholder="Search activities, course, class…" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9 h-9 text-xs"
          />
        </div>
      </CardHeader>
      
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-background/50 border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider font-semibold">
            {table.getHeaderGroups().map(group => (
              <tr key={group.id}>
                {group.headers.map(header => (
                  <th key={header.id} className="px-6 py-4">
                    <button 
                      className="flex items-center gap-2 hover:text-text-primary transition-colors focus:outline-none" 
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? <ArrowUp size={12} className="text-primary" /> : header.column.getIsSorted() === 'desc' ? <ArrowDown size={12} className="text-primary" /> : <ArrowUpDown size={12} className="opacity-50" />}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border-subtle text-xs">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-background/30 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!table.getRowModel().rows.length && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-text-muted italic">
                  No activities match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <CardFooter className="bg-background/50 border-t border-border-subtle p-4 justify-between text-[10px] text-text-muted">
        <span>{table.getRowModel().rows.length} activities</span>
        <span>Click a column header to sort</span>
      </CardFooter>
    </Card>
  );
}
