'use client';
import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useBump } from './motion';

// The page remounts per route, so the last indicator position is kept at module scope
// and the indicator animates from there to the new active link.
let lastRect: { top: number; height: number } | null = null;

export function SidebarNav({ items, section, reviewCount }: { items: readonly (readonly [string, string, LucideIcon])[]; section: string; reviewCount?: number | null }) {
  const navRef = useRef<HTMLElement>(null);
  const [rect, setRect] = useState(lastRect);
  const [animate, setAnimate] = useState(false);
  const bump = useBump(reviewCount);
  useLayoutEffect(() => {
    const measure = () => {
      const active = navRef.current?.querySelector<HTMLAnchorElement>('a.active');
      if (!active) return;
      const next = { top: active.offsetTop, height: active.offsetHeight };
      lastRect = next;
      setRect(next);
    };
    const frame = requestAnimationFrame(() => { setAnimate(true); measure(); });
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', measure); };
  }, [section]);
  return <nav ref={navRef}>
    {rect && <span className="nav-indicator" aria-hidden style={{ transform: `translateY(${rect.top}px)`, height: rect.height, transition: animate ? undefined : 'none' }} />}
    {items.map(([key, label, Icon]) => <Link key={key} href={`/${key}`} data-label={label} aria-label={label} className={section === key ? 'active' : ''}>
      <Icon size={18} />{label}
      {key === 'review' && reviewCount ? <span className={`nav-count${bump ? ' bump' : ''}`}>{reviewCount}</span> : null}
    </Link>)}
  </nav>;
}
