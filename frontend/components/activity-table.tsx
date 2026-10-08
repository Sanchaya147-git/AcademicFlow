'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Activity } from '@/types';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';
import { StatusBadge } from './status-badge';
import { Bar } from './motion';
import { cn } from '@/lib/utils';

export function ActivityTable({ data, schedule = false }: { data: Activity[]; schedule?: boolean }) {
  'use no memo'; // TanStack Table exposes mutable instance functions; do not compiler-memoize.
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Activity>[]>(
    () => [
      {
        accessorKey: 'activity_name',
        header: 'Academic activity',
        cell: ({ row }) => (
          <Link
            href={`/activities/${row.original.id}`}
            className="group flex flex-col py-0.5 max-w-[340px]"
          >
            <span className="font-semibold text-text-primary text-xs group-hover:text-primary transition-colors leading-snug line-clamp-2">
              {row.original.activity_name}
            </span>
            <span className="text-[10px] font-mono text-text-muted mt-0.5 tracking-tight group-hover:text-primary/70 transition-colors">
              {row.original.activity_id}
            </span>
          </Link>
        ),
      },
      {
        accessorKey: 'department',
        header: 'Dept.',
        cell: ({ getValue }) => (
          <span className="text-xs font-medium text-text-secondary">
            {String(getValue() || '—')}
          </span>
        ),
      },
      {
        accessorKey: 'course',
        header: 'Course',
        cell: ({ getValue }) => (
          <span className="text-xs font-semibold text-text-primary">
            {String(getValue() || '—')}
          </span>
        ),
      },
      {
        accessorKey: 'class_section',
        header: 'Class',
        cell: ({ getValue }) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/70 shadow-2xs">
            {String(getValue() || '—')}
          </span>
        ),
      },
      {
        accessorKey: 'planned_end',
        header: 'Planned end',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono text-text-muted whitespace-nowrap">
            {String(getValue() || '—')}
          </span>
        ),
      },
      {
        accessorKey: 'actual_end',
        header: 'Actual end',
        cell: ({ getValue }) => {
          const val = getValue();
          return (
            <span
              className={cn(
                'text-xs font-mono whitespace-nowrap',
                val ? 'text-text-primary font-medium' : 'text-text-muted/60'
              )}
            >
              {String(val || '—')}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <StatusBadge value={String(getValue())} />,
      },
      ...(schedule
        ? [
            {
              id: 'variance',
              header: 'Variance',
              cell: ({ row }: { row: { original: Activity } }) => {
                if (!row.original.actual_end) {
                  return <span className="text-xs text-text-muted/60 italic">Pending</span>;
                }
                const diffDays = Math.round(
                  (Date.parse(row.original.actual_end) - Date.parse(row.original.planned_end)) /
                    86400000
                );
                const isLate = diffDays > 0;
                const isOnTime = diffDays === 0;
                return (
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold',
                      isLate
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : isOnTime
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    )}
                  >
                    {isLate ? `+${diffDays} days` : isOnTime ? 'On schedule' : `${diffDays} days`}
                  </span>
                );
              },
            },
          ]
        : [
            {
              accessorKey: 'completion_percentage',
              header: 'Progress',
              cell: ({ row }: { row: { original: Activity } }) => (
                <div className="flex items-center gap-3 min-w-[130px]">
                  <div className="flex-1 min-w-[70px]">
                    <Bar value={row.original.completion_percentage} label="Completion" />
                  </div>
                  <span className="text-[11px] font-bold text-text-muted tabular-nums w-8 text-right">
                    {row.original.completion_percentage}%
                  </span>
                </div>
              ),
            },
          ]),
    ],
    [schedule]
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: search, sorting },
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white rounded-2xl border border-border-subtle shadow-xs overflow-hidden flex flex-col">
      {/* Table header bar */}
      <div className="p-4 sm:p-5 border-b border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/40">
        <div>
          <h2 className="text-base font-bold text-text-primary tracking-tight">
            {schedule ? 'Execution schedule' : 'Master academic plan'}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            {schedule
              ? 'Tracking timeline variance against institutional milestones'
              : 'Institutional syllabus activities and current progress'}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            aria-label="Search activities"
            placeholder="Search activity, course, class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs transition-all"
          />
        </div>
      </div>

      {/* Table scroll wrapper */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-border-subtle bg-slate-50/80">
                {group.headers.map((header) => {
                  const isSorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted select-none whitespace-nowrap"
                    >
                      <button
                        className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors focus:outline-none group text-left"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        {isSorted === 'asc' ? (
                          <ChevronUp size={13} className="text-primary font-bold" />
                        ) : isSorted === 'desc' ? (
                          <ChevronDown size={13} className="text-primary font-bold" />
                        ) : (
                          <ChevronsUpDown size={12} className="text-slate-300 group-hover:text-slate-500 opacity-60" />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border-subtle/70 bg-white">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-slate-50/70 transition-colors group"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3.5 align-middle text-xs">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {!table.getRowModel().rows.length && (
        <div className="py-12 px-4 text-center">
          <p className="text-xs font-medium text-text-muted">No activities match your filters or search.</p>
        </div>
      )}

      {/* Table footer */}
      <div className="px-4 py-3 bg-slate-50/60 border-t border-border-subtle text-[11px] text-text-muted flex items-center justify-between">
        <span className="font-medium">
          {table.getRowModel().rows.length} {table.getRowModel().rows.length === 1 ? 'activity' : 'activities'} listed
        </span>
        <span className="text-slate-400 hidden sm:inline">Click column headers to sort</span>
      </div>
    </div>
  );
}
