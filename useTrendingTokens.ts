'use client';

import { useQuery } from '@tanstack/react-query';

export type PriceInfo = {
  usd: number;
  change24h: number;
  liquidity: number;
};

export function useTokenPrices(addresses: string[]) {
  return useQuery({
    queryKey: ['prices', [...addresses].sort().join(',')],
    queryFn: async (): Promise<Record<string, PriceInfo>> => {
      if (!addresses.length) return {};
      const result: Record<string, PriceInfo> = {};

      const chunks: string[][] = [];
      for (let i = 0; i < addresses.length; i += 30) {
        chunks.push(addresses.slice(i, i + 30));
      }

      await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const url = `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`;
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            const pairs = data?.pairs || [];

            for (const pair of pairs) {
              if (pair.chainId !== 'worldchain') continue;
              const addr = pair.baseToken?.address?.toLowerCase();
              if (!addr) continue;

              const liq = parseFloat(pair.liquidity?.usd || '0');
              const existing = result[addr];
              const existingLiq = (existing as any)?._liq || 0;

              if (!existing || liq > existingLiq) {
                result[addr] = {
                  usd: parseFloat(pair.priceUsd || '0'),
                  change24h: parseFloat(pair.priceChange?.h24 || '0'),
                  liquidity: liq,
                };
                (result[addr] as any)._liq = liq;
              }
            }
          } catch (err) {
            console.error('DexScreener:', err);
          }
        })
      );
      return result;
    },
    enabled: addresses.length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
