'use client';

import { useState, useEffect } from 'react';
import { Search, TrendingUp, Clock, Pin, RefreshCw } from 'lucide-react';
import { useSearchTokens, type SearchedToken } from '@/hooks/useSearchTokens';
import { useTrendingTokens } from '@/hooks/useTrendingTokens';
import { TokenRowSkeleton } from './Skeletons';
import { TokenLogo } from './TokenLogo';
import { SwapModal } from './SwapModal';
import { findToken } from '@/config/tokens';

export function SearchView({ walletAddress }: { walletAddress: string | null }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selectedToken, setSelectedToken] = useState<SearchedToken | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(id);
  }, [query]);

  const { data: searchResults, isLoading: isSearching } = useSearchTokens(debounced);
  const { data: trendingData, isLoading: isTrendingLoading, refetch } =
    useTrendingTokens();

  const isSearchMode = debounced.trim().length >= 2;

  const handleSelectToken = (t: SearchedToken) => {
    // Si es un token conocido, abrir swap directamente
    // Si es uno descubierto, pasamos por el modal pero usuario tiene que importarlo manualmente
    if (!walletAddress) {
      alert('Iniciá sesión primero para hacer swap');
      return;
    }
    const known = findToken(t.address);
    if (known) {
      setSelectedToken(t);
    } else {
      // Token no curado, redirigir a importarlo manualmente
      alert(
        `Para swappear ${t.symbol}, primero importálo desde la pestaña Wallet (botón "+ Importar")`
      );
    }
  };

  const minutesAgo = trendingData?.updatedAt
    ? Math.floor((Date.now() - trendingData.updatedAt) / 60000)
    : 0;

  return (
    <div className="px-4 py-5 pb-28 space-y-4 animate-fade-in">
      <div>
        <h1 className="font-cyber text-2xl font-black text-white">Buscar</h1>
        <p className="text-xs text-gray-400 mt-1">
          Encontrá tokens en World Chain
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Símbolo, nombre o 0x..."
          className="w-full pl-10 pr-3 py-3 rounded-2xl bg-nex-panel border border-white/10 text-sm text-white placeholder:text-gray-500 focus:border-nex-green/40 focus:outline-none"
        />
      </div>

      {isSearchMode ? (
        // === MODO BUSQUEDA ===
        <SearchResults
          results={searchResults}
          isLoading={isSearching}
          onSelect={handleSelectToken}
        />
      ) : (
        // === MODO TRENDING ===
        <TrendingSection
          pinned={trendingData?.pinned || []}
          trending={trendingData?.trending || []}
          isLoading={isTrendingLoading}
          minutesAgo={minutesAgo}
          onSelect={handleSelectToken}
          onRefresh={() => refetch()}
        />
      )}

      {selectedToken && walletAddress && (
        <SwapModal
          walletAddress={walletAddress}
          initialFromSymbol="WLD"
          onClose={() => setSelectedToken(null)}
        />
      )}
    </div>
  );
}

function TrendingSection({
  pinned,
  trending,
  isLoading,
  minutesAgo,
  onSelect,
  onRefresh,
}: {
  pinned: SearchedToken[];
  trending: SearchedToken[];
  isLoading: boolean;
  minutesAgo: number;
  onSelect: (t: SearchedToken) => void;
  onRefresh: () => void;
}) {
  if (isLoading && pinned.length === 0 && trending.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp className="w-4 h-4 text-nex-green" />
          <h2 className="font-cyber text-sm font-bold text-white uppercase tracking-wide">
            En Tendencia
          </h2>
        </div>
        <TokenRowSkeleton />
        <TokenRowSkeleton />
        <TokenRowSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-nex-green" />
          <h2 className="font-cyber text-sm font-bold text-white uppercase tracking-wide">
            En Tendencia
          </h2>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 text-[10px] text-gray-500 active:scale-95 transition-transform"
        >
          <Clock className="w-3 h-3" />
          {minutesAgo === 0 ? 'Recién' : `Hace ${minutesAgo} min`}
          <RefreshCw className="w-3 h-3 ml-1" />
        </button>
      </div>

      {/* Pinned tokens (NXCH siempre arriba) */}
      {pinned.length > 0 && (
        <div className="space-y-2">
          {pinned.map((t) => (
            <TokenCard
              key={`pinned-${t.address}`}
              token={t}
              isPinned
              onClick={() => onSelect(t)}
            />
          ))}
        </div>
      )}

      {/* Trending tokens */}
      {trending.length > 0 ? (
        <div className="space-y-2">
          {trending.map((t) => (
            <TokenCard
              key={t.address}
              token={t}
              onClick={() => onSelect(t)}
            />
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="text-center py-8 rounded-2xl bg-nex-panel border border-white/5">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-sm text-gray-400">Sin datos de tendencia</div>
            <div className="text-xs text-gray-600 mt-1">
              Probá actualizar en unos minutos
            </div>
          </div>
        )
      )}

      <p className="text-[10px] text-center text-gray-600 pt-2">
        Datos proporcionados por DexScreener · World Chain
      </p>
    </div>
  );
}

function SearchResults({
  results,
  isLoading,
  onSelect,
}: {
  results?: SearchedToken[];
  isLoading: boolean;
  onSelect: (t: SearchedToken) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <TokenRowSkeleton />
        <TokenRowSkeleton />
        <TokenRowSkeleton />
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl bg-nex-panel border border-white/5">
        <div className="text-3xl mb-2">🔍</div>
        <div className="text-sm text-gray-400">Sin resultados</div>
        <div className="text-xs text-gray-600 mt-1">
          Probá con otro nombre o dirección
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((t) => (
        <TokenCard key={t.address} token={t} onClick={() => onSelect(t)} />
      ))}
    </div>
  );
}

function TokenCard({
  token,
  isPinned,
  onClick,
}: {
  token: SearchedToken;
  isPinned?: boolean;
  onClick: () => void;
}) {
  const isUp = token.change24h >= 0;

  const fmtNum = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    if (n === 0) return '-';
    return `$${n.toFixed(0)}`;
  };

  const fmtPrice = (n: number) => {
    if (n === 0) return '-';
    if (n < 0.0001) return n.toExponential(2);
    if (n < 1) return n.toFixed(6);
    return n.toFixed(4);
  };

  return (
    <button
      onClick={onClick}
      className={`block w-full p-3 rounded-2xl border transition-transform active:scale-[0.98] text-left ${
        isPinned
          ? 'bg-gradient-to-br from-nex-green/10 to-nex-cyan/5 border-nex-green/30'
          : 'bg-nex-panel border-white/5'
      }`}
    >
      <div className="flex items-center gap-3">
        <TokenLogo symbol={token.symbol} logo={token.icon} size="lg" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-sm truncate">
              {token.symbol}
            </span>
            {isPinned && (
              <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded bg-nex-green/20 text-nex-green border border-nex-green/40 uppercase tracking-wide font-bold">
                <Pin className="w-2.5 h-2.5" />
                Destacado
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 truncate">{token.name}</div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-bold text-white text-sm font-mono">
            ${fmtPrice(token.priceUsd)}
          </div>
          {token.change24h !== 0 && (
            <div className={`text-xs ${isUp ? 'text-nex-green' : 'text-red-400'}`}>
              {isUp ? '+' : ''}
              {token.change24h.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5">
        <Stat label="MCap" value={fmtNum(token.marketCap)} />
        <Stat label="Liquidez" value={fmtNum(token.liquidity)} />
        <Stat label="Vol 24h" value={fmtNum(token.volume24h)} />
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-xs text-white font-mono">{value}</div>
    </div>
  );
}
