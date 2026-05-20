'use client';

import { useQuery } from '@tanstack/react-query';

export type SearchedToken = {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  liquidity: number;
  volume24h: number;
  marketCap: number;
  icon?: string;
};

export function useSearchTokens(query: string) {
  return useQuery({
    queryKey: ['search-tokens', query],
    queryFn: async (): Promise<SearchedToken[]> => {
      if (!query || query.trim().length < 2) return [];
      try {
        // Si es una address (0x...), buscar por address
        const isAddr = /^0x[a-fA-F0-9]{40}$/.test(query.trim());
        const url = isAddr
          ? `https://api.dexscreener.com/latest/dex/tokens/${query.trim()}`
          : `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query.trim())}`;

        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        const pairs = (data?.pairs || []).filter(
          (p: any) => p.chainId === 'worldchain'
        );

        // Agrupar por baseToken (quedarse con el de más liquidez)
        const byToken = new Map<string, any>();
        for (const p of pairs) {
          const addr = p.baseToken?.address?.toLowerCase();
          if (!addr) continue;
          const liq = parseFloat(p.liquidity?.usd || '0');
          const ex = byToken.get(addr);
          if (!ex || parseFloat(ex.liquidity?.usd || '0') < liq) {
            byToken.set(addr, p);
          }
        }

        return Array.from(byToken.values())
          .map(
            (p): SearchedToken => ({
              address: p.baseToken?.address || '',
              symbol: p.baseToken?.symbol || '?',
              name: p.baseToken?.name || '?',
              priceUsd: parseFloat(p.priceUsd || '0'),
              change24h: parseFloat(p.priceChange?.h24 || '0'),
              liquidity: parseFloat(p.liquidity?.usd || '0'),
              volume24h: parseFloat(p.volume?.h24 || '0'),
              marketCap:
                parseFloat(p.marketCap || '0') || parseFloat(p.fdv || '0'),
              icon: p.info?.imageUrl,
            })
          )
          .sort((a, b) => b.liquidity - a.liquidity);
      } catch (err) {
        console.error('Search error:', err);
        return [];
      }
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}
