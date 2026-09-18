'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table';
import { Activity } from '@/types';

export function ActivityTable({ data, schedule = false }: { data: Activity[]; schedule?: boolean }) {
  'use no memo'; // TanStack Table exposes mutable instance functions; do not compiler-memoize.
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<Activity>[]>(() => [
    { accessorKey: 'activity_name', header: 'Academic activity', cell: ({ row }) => <Link className="activity-link" href={`/activities/${row.original.id}`}><strong>{row.original.activity_name}</strong><small>{row.original.activity_id}</small></Link> },
    { accessorKey: 'department', header: 'Dept.' },
    { accessorKey: 'course', header: 'Course' },
    { accessorKey: 'class_section', header: 'Class' },
    { accessorKey: 'planned_end', header: 'Planned end' },
    { accessorKey: 'actual_end', header: 'Actual end', cell: ({ getValue }) => String(getValue() || '—') },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <span className={`badge ${String(getValue()).toLowerCase()}`}>{String(getValue()).replaceAll('_', ' ')}</span> },
    ...(schedule ? [{ id: 'variance', header: 'Variance', cell: ({ row }: { row: { original: Activity } }) => row.original.actual_end ? `${Math.round((Date.parse(row.original.actual_end) - Date.parse(row.original.planned_end)) / 86400000)} days` : 'Not yet known' }] : [
      { accessorKey: 'completion_percentage', header: 'Progress', cell: ({ row }: { row: { original: Activity } }) => <div className="progress-cell"><progress max={100} value={row.original.completion_percentage} /><small>{row.original.completion_percentage}%</small></div> },
    ]),
  ], [schedule]);
  const table = useReactTable({ data, columns, state: { globalFilter: search, sorting }, onGlobalFilterChange: setSearch,
    onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel() });
  return <div className="panel"><div className="panel-heading"><h2>{schedule ? 'Execution schedule' : 'Master academic plan'}</h2><input aria-label="Search activities" placeholder="Search activities, course, class…" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className="table-scroll"><table><thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(header => <th key={header.id}><button className="sort-button" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}</button></th>)}</tr>)}</thead>
      <tbody>{table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div>
    {!table.getRowModel().rows.length && <p className="empty">No activities match your filters.</p>}<div className="table-footer">{table.getRowModel().rows.length} activities · Click a column to sort</div></div>;
}
