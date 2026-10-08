'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { TopNav } from '@/components/layout/top-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuth } from '@/components/auth-provider';

import { LogoMark } from '@/components/logo';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // While checking auth, show an animated loader with logo mark pulse
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="boot" role="status">
          <LogoMark size={48} live={false} />
          <p className="text-sm font-medium text-[#60718a]">Connecting to AcademicFlow…</p>
        </div>
      </div>
    );
  }

  // If not user and not loading, the AuthProvider handles the redirect.
  if (!user) return null;

  return (
    <div className="min-h-screen w-full bg-[#FAFAFC] flex flex-col">
      {/* Top Header */}
      <Header onMenuClick={() => setMobileMenuOpen(true)} />

      {/* Horizontal Top Navigation Bar (Upside Nav) */}
      <TopNav />

      {/* Mobile Drawer (Accessible when menu hamburger tapped on small screens) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-50 flex shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar className="w-64 max-w-[85vw]" onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Full-Width Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-[1600px] mx-auto w-full animate-in fade-in-50 duration-300 slide-in-from-bottom-1">
          {children}
        </div>
      </main>
    </div>
  );
}
