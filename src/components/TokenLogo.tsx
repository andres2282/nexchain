'use client';

import { useState } from 'react';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { box: string; text: string }> = {
  sm: { box: 'w-5 h-5', text: 'text-[8px]' },
  md: { box: 'w-9 h-9', text: 'text-[10px]' },
  lg: { box: 'w-11 h-11', text: 'text-xs' },
};

// Genera color basado en el symbol (consistente entre renders)
function gradientFromSymbol(symbol: string): string {
  const gradients = [
    'from-nex-green/40 to-nex-cyan/40',
    'from-purple-500/40 to-pink-500/40',
    'from-blue-500/40 to-cyan-500/40',
    'from-orange-500/40 to-amber-500/40',
    'from-pink-500/40 to-rose-500/40',
    'from-emerald-500/40 to-teal-500/40',
    'from-indigo-500/40 to-blue-500/40',
    'from-yellow-500/40 to-orange-500/40',
  ];

  // Hash simple basado en el symbol
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash * 31 + symbol.charCodeAt(i)) | 0;
  }
  return gradients[Math.abs(hash) % gradients.length];
}

export function TokenLogo({
  symbol,
  logo,
  size = 'lg',
}: {
  symbol: string;
  logo?: string;
  size?: Size;
}) {
  const [errored, setErrored] = useState(false);
  const sz = SIZES[size];
  const initials = symbol.slice(0, 2).toUpperCase();

  // Si no hay logo o fallo la carga, mostrar fallback
  if (!logo || errored) {
    const gradient = gradientFromSymbol(symbol);
    return (
      <div
        className={`${sz.box} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black shrink-0 border border-white/10`}
      >
        <span className={sz.text}>{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={logo}
      alt={symbol}
      className={`${sz.box} rounded-full bg-black/40 shrink-0 object-cover`}
      onError={() => setErrored(true)}
    />
  );
}
