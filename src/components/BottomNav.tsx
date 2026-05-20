'use client';

import { Wallet, Search, Clock } from 'lucide-react';

export type Tab = 'wallet' | 'search' | 'history';

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'search', label: 'Buscar', icon: Search },
  { id: 'history', label: 'Historial', icon: Clock },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-nex-bg/95 backdrop-blur-xl border-t border-white/10 z-20">
      <div
        className="flex items-center justify-around px-2 py-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex flex-col items-center gap-1 px-6 py-1.5 relative active:scale-95 transition-transform"
            >
              {isActive && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-nex-green rounded-full shadow-glow-green" />
              )}
              <Icon
                className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-nex-green' : 'text-gray-500'
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-nex-green' : 'text-gray-500'
                }`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
