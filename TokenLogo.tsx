'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { HexLogo } from './HexLogo';

export function Header({ address }: { address?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <header className="px-4 py-3 flex items-center justify-between border-b border-white/5 bg-nex-bg/95 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <HexLogo size={32} />
        <div className="font-cyber font-black text-lg tracking-tight">
          <span className="text-white">NEX</span>
          <span className="bg-gradient-to-r from-nex-green to-nex-cyan bg-clip-text text-transparent">
            CHAIN
          </span>
        </div>
      </div>
      {address && (
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-nex-panel border border-white/10 text-xs text-gray-300 active:scale-95 transition-transform"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-nex-green animate-pulse" />
          <span className="font-mono">
            {address.slice(0, 4)}…{address.slice(-4)}
          </span>
          {copied ? (
            <Check className="w-3 h-3 text-nex-green" />
          ) : (
            <Copy className="w-3 h-3 text-gray-500" />
          )}
        </button>
      )}
    </header>
  );
}
