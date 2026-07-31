import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AnimatedBackground from './AnimatedBackground';
import MobileBottomNav from './MobileBottomNav';
import UserMenu from './UserMenu';
import Onboarding, { shouldShowOnboarding } from '@/components/Onboarding';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => { setOnboarding(shouldShowOnboarding()); }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {onboarding && <Onboarding onClose={() => setOnboarding(false)} />}
      {/* Tactical background */}
      <AnimatedBackground />

      {/* Scan lines overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-scan-lines opacity-40" />

      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuChange={setMobileMenuOpen}
      />

      {/* Bottom nav mobile */}
      <MobileBottomNav onMenuOpen={() => setMobileMenuOpen(true)} />

      {/* Main content */}
      <main className={cn(
        'min-h-screen transition-all duration-300 relative z-10',
        collapsed ? 'sm:ml-14' : 'sm:ml-56',
        'ml-0 pb-16 sm:pb-0'
      )}>
        {/* Mobile top bar */}
        <div className="sm:hidden flex items-center justify-between px-4 h-12 border-b border-primary/10 bg-background/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full status-online animate-pulse" />
            <span className="text-[10px] font-mono text-primary/70 uppercase tracking-widest font-display">NEURIX</span>
          </div>
          <UserMenu compact />
        </div>

        {/* Top status bar — desktop only */}
        <div className="hidden sm:flex items-center justify-between px-5 h-10 border-b border-primary/10 bg-background/60 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full status-online animate-pulse" />
              <span className="text-[9px] font-mono text-primary/70 uppercase tracking-widest">SISTEMA OPERACIONAL</span>
            </div>
            <span className="text-[9px] text-border font-mono">|</span>
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">NEURIX · ML Workbench</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-muted-foreground">STATUS:</span>
              <span className="text-[9px] font-mono text-accent font-bold">ONLINE</span>
            </div>
            <ClockDisplay />
            <div className="w-px h-5 bg-border/60" />
            <UserMenu />
          </div>
        </div>

        <div className="p-3 sm:p-5 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function ClockDisplay() {
  const [time, setTime] = React.useState(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  React.useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <div className="text-[9px] font-mono text-muted-foreground">{time}</div>;
}