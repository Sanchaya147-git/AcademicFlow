'use client';
import { Menu, Bell, LogOut, Search } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-border-subtle flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-30">
      {/* Left: mobile menu + search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-accent-violet/40 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="hidden sm:flex items-center gap-2 bg-background border border-border-subtle rounded-xl px-3 py-2 flex-1">
          <Search size={15} className="text-text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search activities, reports…"
            className="bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Right: notifications + avatar + logout */}
      <div className="flex items-center gap-2 ml-4">
        <button
          className="relative p-2 text-text-muted hover:text-text-primary hover:bg-accent-violet/40 rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border-2 border-white" />
        </button>

        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 text-white ml-1"
          style={{ background: 'linear-gradient(135deg, #4F6EF7, #A78BFA)' }}>
          {user.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="hidden md:block">
          <div className="text-xs font-semibold text-text-primary leading-tight">{user.name}</div>
          <div className="text-[10px] text-text-muted capitalize leading-tight">
            {user.role.replaceAll('_', ' ').toLowerCase()}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          title="Sign out"
          className="text-text-muted hover:text-danger hover:bg-danger/10 ml-1"
        >
          <LogOut size={17} />
        </Button>
      </div>
    </header>
  );
}
