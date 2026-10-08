import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

export function LogoMark({ size = 39, live = true }: { size?: number; live?: boolean }) {
  return <span className="logo-mark" style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }} aria-hidden>
    <span className="logo-sheen" />
    <GraduationCap size={Math.round(size * 0.58)} />
    {live && <span className="logo-dot" />}
  </span>;
}

export function Wordmark({ as: Tag = 'span' }: { as?: 'span' | 'h1' }) {
  return <Tag className="wordmark">Academic<b>Flow</b></Tag>;
}

export function Logo() {
  return <Link href="/dashboard" className="brand" aria-label="AcademicFlow home">
    <LogoMark />
    <div><Wordmark /><small>EXECUTION INTELLIGENCE</small></div>
  </Link>;
}
