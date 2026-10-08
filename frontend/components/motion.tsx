'use client';
import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const seen = new Set<string>();

// Counts up once per session per id; later refreshes show the value directly.
export function CountUp({ id, value, suffix = '' }: { id: string; value: number | null; suffix?: string }) {
  const [shown, setShown] = useState(() => (value === null || seen.has(id) ? value : 0));
  useEffect(() => {
    if (value === null) return;
    if (seen.has(id) || reduced()) { seen.add(id); const r = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(r); }
    seen.add(id);
    const start = performance.now(), duration = 900;
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - p, 3);
      setShown(Number.isInteger(value) ? Math.round(value * eased) : Math.round(value * eased * 10) / 10);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [id, value]);
  return <>{shown === null ? '—' : `${shown}${suffix}`}</>;
}

// Div-based bar so the fill can transition; starts at 0 and fills after mount.
export function Bar({ value, index = 0, label }: { value: number; index?: number; label?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(r); }, []);
  const width = Math.max(0, Math.min(100, value));
  return <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} aria-label={label} style={{ '--i': index } as React.CSSProperties}><span style={{ width: ready ? `${width}%` : 0 }} /></div>;
}

export function Meter({ value }: { value: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(r); }, []);
  const tone = value >= 90 ? 'high' : value >= 50 ? 'medium' : 'low';
  return <div className={`meter ${tone}`} aria-hidden><span style={{ width: ready ? `${Math.min(100, value)}%` : 0 }} /></div>;
}

export function PageSkeleton({ kind }: { kind: 'metrics' | 'table' | 'cards' }) {
  return <div className="skeleton-page" role="status" aria-label="Loading live academic data">
    {kind === 'metrics' && <div className="metric-grid">{[0, 1, 2, 3].map(i => <div key={i} className="metric skeleton" />)}</div>}
    <div className="chart-grid" style={kind === 'metrics' ? undefined : { gridTemplateColumns: '1fr' }}>
      <div className="skeleton skeleton-panel" />{kind === 'metrics' && <div className="skeleton skeleton-panel" />}
    </div>
  </div>;
}

// Adds .bump to the nav count whenever its value changes.
export function useBump(value: unknown) {
  const [bump, setBump] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const on = requestAnimationFrame(() => setBump(true));
    const off = setTimeout(() => setBump(false), 360);
    return () => { cancelAnimationFrame(on); clearTimeout(off); };
  }, [value]);
  return bump;
}
