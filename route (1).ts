'use client';

import { useQuery } from '@tanstack/react-query';
import { NXCH_ADDRESS } from '@/config/tokens';
import type { SearchedToken } from './useSearchTokens';

const TRENDING_CACHE_TIME = 20 * 60 * 1000; // 20 min
const MIN_LIQUIDITY = 0;

// Tokens curados que SIEMPRE aparecen primero en trending (fijados por Andres)
const PINNED_TOKENS: string[] = [
  NXCH_ADDRESS, // NXCH siempre arriba
];

// Tokens "anchor" en World Chain para buscar pares
const ANCHOR_QUERIES = ['WLD', 'USDC', 'WETH'];

async function fetchPairsForQuery(query: string): Promise<any[]> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.pairs || []).filter((p: any) => p.chainId === 'worldchain');
  } catch {
    return [];
  }
}

async function fetchTokenByAddress(address: string): Promise<any | null> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pairs = (data?.pairs || []).filter(
      (p: any) => p.chainId === 'worldchain'
    );
    if (pairs.length === 0) return null;
    // Quedarse con el par de mas liquidez
    return pairs.reduce((max: any, p: any) => {
      const maxLiq = parseFloat(max?.liquidity?.usd || '0');
      const curLiq = parseFloat(p?.liquidity?.usd || '0');
      return curLiq > maxLiq ? p : max;
    }, pairs[0]);
  } catch {
    return null;
  }
}

function pairToToken(p: any): SearchedToken {
  return {
    address: (p.baseToken?.address || '').toLowerCase(),
    symbol: p.baseToken?.symbol || '?',
    name: p.baseToken?.name || '?',
    priceUsd: parseFloat(p.priceUsd || '0'),
    change24h: parseFloat(p.priceChange?.h24 || '0'),
    liquidity: parseFloat(p.liquidity?.usd || '0'),
    volume24h: parseFloat(p.volume?.h24 || '0'),
    marketCap:
      parseFloat(p.marketCap || '0') || parseFloat(p.fdv || '0'),
    icon: p.info?.imageUrl,
  };
}

export function useTrendingTokens() {
  return useQuery({
    queryKey: ['trending-tokens-v1'],
    queryFn: async (): Promise<{
      pinned: SearchedToken[];
      trending: SearchedToken[];
      updatedAt: number;
    }> => {
      // 1. Pinned tokens (NXCH y otros que vos quieras fijar)
      const pinned: SearchedToken[] = [];
      await Promise.all(
        PINNED_TOKENS.map(async (addr) => {
          const pair = await fetchTokenByAddress(addr);
          if (pair) {
            pinned.push(pairToToken(pair));
          } else {
            // Si DexScreener no lo indexa todavia, ponemos un placeholder
            if (addr.toLowerCase() === NXCH_ADDRESS.toLowerCase()) {
              pinned.push({
                address: NXCH_ADDRESS.toLowerCase(),
                symbol: 'NXCH',
                name: 'NexChain Token',
                priceUsd: 0,
                change24h: 0,
                liquidity: 0,
                volume24h: 0,
                marketCap: 0,
                icon: 'https://i.ibb.co/4Zxnzjjq/3-C8-E7-D07-87-DE-4-F10-8952-F14-DCA7-E5-B45.jpg',
              });
            }
          }
        })
      );

      // 2. Trending: buscar pares populares contra anchors
      const allPairs: any[] = [];
      const results = await Promise.all(
        ANCHOR_QUERIES.map((q) => fetchPairsForQuery(q))
      );
      for (const pairs of results) {
        allPairs.push(...pairs);
      }

      // Dedup por baseToken address (quedarse con el de mas liquidez)
      const byToken = new Map<string, any>();
      for (const p of allPairs) {
        const addr = p.baseToken?.address?.toLowerCase();
        if (!addr) continue;
        // Skip tokens pinned
        if (PINNED_TOKENS.some((a) => a.toLowerCase() === addr)) continue;
        const liq = parseFloat(p.liquidity?.usd || '0');
        const ex = byToken.get(addr);
        if (!ex || parseFloat(ex.liquidity?.usd || '0') < liq) {
          byToken.set(addr, p);
        }
      }

      // Convertir a tokens y filtrar por liquidez
      const trending = Array.from(byToken.values())
        .map(pairToToken)
        .filter((t) => t.liquidity >= MIN_LIQUIDITY)
        // Ordenar por volumen 24h (lo que "trending" realmente significa)
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, 20); // top 20

      return {
        pinned,
        trending,
        updatedAt: Date.now(),
      };
    },
    staleTime: TRENDING_CACHE_TIME,
    refetchInterval: TRENDING_CACHE_TIME,
    refetchOnWindowFocus: false,
  });
}
