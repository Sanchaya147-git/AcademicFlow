import type { Metadata } from 'next';
import './globals.css';
import './motion.css';
import { SessionProvider } from '@/components/session';
export const metadata: Metadata = { title: 'AcademicFlow — Execution Intelligence', description: 'Source-backed academic execution intelligence, with humans in control.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><SessionProvider>{children}</SessionProvider></body></html>;
}
