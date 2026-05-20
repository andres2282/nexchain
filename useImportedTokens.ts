'use client';

import { useQuery } from '@tanstack/react-query';
import { publicClient } from '@/lib/viem';
import { ERC20_ABI } from '@/lib/abis';
import { useImportedTokens } from './useImportedTokens';
import { VISIBLE_TOKENS, isKnownToken } from '@/config/tokens';
import { estimateTokenLiquidity } from '@/lib/liquidity';

export type DiscoveredToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  raw: bigint;
  formatted: string;
  balanceNum: number;
  isImported?: boolean;
  isKnown?: boolean;
  liquidityUsd?: number;
  lowLiquidity?: boolean;
};

const WORLDSCAN_API = 'https://api.worldscan.org/api';
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || '';
const ALCHEMY_URL = ALCHEMY_KEY
  ? `https://worldchain-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : '';

// Filtro de liquidez DESACTIVADO por ahora (era demasiado agresivo)
// Si querés activarlo, cambiar a un valor mayor a 0
const MIN_LIQUIDITY_USD = 0;

function formatBalance(raw: bigint, decimals: number) {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 6);
  const formatted = `${whole.toString()}.${fracStr}`;
  return { formatted, balanceNum: parseFloat(formatted) };
}

async function readTokenBalance(walletAddress: string, tokenAddress: string): Promise<bigint | null> {
  try {
    return (await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    })) as bigint;
  } catch {
    return null;
  }
}

// Tokens curados (WLD, USDC, WETH, NXCH): SIEMPRE visibles, sin filtro
// Si el RPC falla al leer balance, igual se muestran con balance 0
async function fetchKnownTokens(walletAddress: string): Promise<DiscoveredToken[]> {
  const results: DiscoveredToken[] = [];
  await Promise.all(
    VISIBLE_TOKENS.map(async (token) => {
      let balance: bigint = 0n;
      try {
        const result = await readTokenBalance(walletAddress, token.address);
        if (result !== null) balance = result;
      } catch (err) {
        console.warn(`No se pudo leer balance de ${token.symbol}:`, err);
      }
      const { formatted, balanceNum } = formatBalance(balance, token.decimals);
      results.push({
        address: token.address.toLowerCase(),
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logo: token.logo || undefined,
        raw: balance,
        formatted,
        balanceNum,
        isKnown: true,
      });
    })
  );
  return results;
}

// Auto-descubiertos por Worldscan (CON filtro de liquidez)
async function fetchFromWorldscan(walletAddress: string): Promise<DiscoveredToken[]> {
  try {
    const url = `${WORLDSCAN_API}?module=account&action=tokentx&address=${walletAddress}&page=1&offset=200&sort=desc`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const txs = data?.result;
    if (!Array.isArray(txs)) return [];

    const tokenMap = new Map<string, { symbol: string; name: string; decimals: number }>();
    for (const tx of txs) {
      const addr = (tx.contractAddress || '').toLowerCase();
      if (!addr || addr.length !== 42) continue;
      if (isKnownToken(addr)) continue; // skip si ya esta curado
      if (!tokenMap.has(addr)) {
        tokenMap.set(addr, {
          symbol: tx.tokenSymbol || '?',
          name: tx.tokenName || tx.tokenSymbol || '?',
          decimals: parseInt(tx.tokenDecimal || '18'),
        });
      }
    }

    const results: DiscoveredToken[] = [];
    const entries = Array.from(tokenMap.entries()).slice(0, 30);
    await Promise.all(
      entries.map(async ([addr, meta]) => {
        const balance = await readTokenBalance(walletAddress, addr);
        if (balance === null || balance === 0n) return;

        // FILTRO DE LIQUIDEZ: solo mostrar si tiene 500+ USD
        const liquidityUsd = await estimateTokenLiquidity(addr);
        if (liquidityUsd < MIN_LIQUIDITY_USD) return; // OCULTAR

        const { formatted, balanceNum } = formatBalance(balance, meta.decimals);
        results.push({
          address: addr,
          symbol: meta.symbol,
          name: meta.name,
          decimals: meta.decimals,
          raw: balance,
          formatted,
          balanceNum,
          liquidityUsd,
        });
      })
    );
    return results;
  } catch (err) {
    console.error('Worldscan error:', err);
    return [];
  }
}

// Auto-descubiertos por Alchemy (CON filtro de liquidez)
async function fetchFromAlchemy(walletAddress: string): Promise<DiscoveredToken[]> {
  if (!ALCHEMY_URL) return [];
  try {
    const balRes = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getTokenBalances',
        params: [walletAddress, 'erc20'],
      }),
    });
    if (!balRes.ok) return [];
    const balData = await balRes.json();
    const raw = balData?.result?.tokenBalances || [];
    const nonZero = raw.filter((b: any) => {
      if (!b.tokenBalance) return false;
      try { return BigInt(b.tokenBalance) > 0n; } catch { return false; }
    });
    if (nonZero.length === 0) return [];

    // Skip tokens conocidos (ya los maneja fetchKnownTokens)
    const filtered = nonZero.filter((b: any) => !isKnownToken(b.contractAddress));
    const limited = filtered.slice(0, 40);

    const metaResults = await Promise.all(
      limited.map(async (b: any) => {
        try {
          const r = await fetch(ALCHEMY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'alchemy_getTokenMetadata',
              params: [b.contractAddress],
            }),
          });
          const data = await r.json();
          return { address: b.contractAddress, raw: b.tokenBalance, meta: data?.result };
        } catch { return null; }
      })
    );

    const tokens: DiscoveredToken[] = [];
    await Promise.all(
      metaResults.map(async (m) => {
        if (!m || !m.meta || !m.meta.symbol) return;

        // FILTRO DE LIQUIDEZ
        const liquidityUsd = await estimateTokenLiquidity(m.address);
        if (liquidityUsd < MIN_LIQUIDITY_USD) return; // OCULTAR

        try {
          const rawBig = BigInt(m.raw);
          const decimals = m.meta.decimals ?? 18;
          const { formatted, balanceNum } = formatBalance(rawBig, decimals);
          tokens.push({
            address: m.address,
            symbol: m.meta.symbol,
            name: m.meta.name || m.meta.symbol,
            decimals,
            logo: m.meta.logo || undefined,
            raw: rawBig,
            formatted,
            balanceNum,
            liquidityUsd,
          });
        } catch {}
      })
    );
    return tokens;
  } catch (err) {
    console.error('Alchemy error:', err);
    return [];
  }
}

// Tokens importados manualmente: SIEMPRE visibles, con su logo personalizado
async function fetchImportedTokens(
  walletAddress: string,
  importedMeta: { address: string; logo?: string }[]
): Promise<DiscoveredToken[]> {
  if (importedMeta.length === 0) return [];
  const results: DiscoveredToken[] = [];
  await Promise.all(
    importedMeta.map(async ({ address: addr, logo }) => {
      // Skip si ya es un token conocido
      if (isKnownToken(addr)) return;

      try {
        const [balance, decimals, symbol, name] = await Promise.all([
          publicClient.readContract({
            address: addr as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: addr as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals',
          }) as Promise<number>,
          publicClient.readContract({
            address: addr as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol',
          }) as Promise<string>,
          publicClient.readContract({
            address: addr as `0x${string}`, abi: ERC20_ABI, functionName: 'name',
          }).catch(() => '') as Promise<string>,
        ]);

        // Liquidez (NO filtra, solo agrega warning si <50)
        const liquidityUsd = await estimateTokenLiquidity(addr).catch(() => 0);

        const { formatted, balanceNum } = formatBalance(balance, decimals);
        results.push({
          address: addr.toLowerCase(),
          symbol: symbol || '?',
          name: name || symbol || '?',
          decimals,
          logo: logo || undefined,  // FIX: ahora pasa el logo del usuario
          raw: balance,
          formatted,
          balanceNum,
          isImported: true,
          liquidityUsd,
          lowLiquidity: liquidityUsd > 0 && liquidityUsd < 50,
        });
      } catch (err) {
        console.error(`Error importing token ${addr}:`, err);
      }
    })
  );
  return results;
}

export function useAllTokenBalances(walletAddress: string | null) {
  const { imported, importedMeta } = useImportedTokens();

  return useQuery({
    queryKey: ['balances-v6', walletAddress, imported.join(',')],
    queryFn: async (): Promise<DiscoveredToken[]> => {
      if (!walletAddress) return [];

      const [knownTokens, alchemyTokens, worldscanTokens, importedTokens] =
        await Promise.all([
          fetchKnownTokens(walletAddress),
          fetchFromAlchemy(walletAddress),
          fetchFromWorldscan(walletAddress),
          fetchImportedTokens(walletAddress, importedMeta),
        ]);

      // Combinar todos por address (prioridad: known > alchemy > worldscan)
      const byAddr = new Map<string, DiscoveredToken>();

      for (const t of worldscanTokens) {
        byAddr.set(t.address.toLowerCase(), t);
      }
      for (const t of alchemyTokens) {
        const ex = byAddr.get(t.address.toLowerCase());
        if (ex) {
          if (!ex.logo && t.logo) ex.logo = t.logo;
        } else {
          byAddr.set(t.address.toLowerCase(), t);
        }
      }
      // Known tokens al final = sobreescriben todo (con logos correctos)
      for (const t of knownTokens) {
        byAddr.set(t.address.toLowerCase(), t);
      }
      // Importados se agregan (si ya existe, marcamos como importado y traemos logo)
      for (const t of importedTokens) {
        const ex = byAddr.get(t.address.toLowerCase());
        if (ex) {
          ex.isImported = true;
          ex.lowLiquidity = t.lowLiquidity;
          ex.liquidityUsd = t.liquidityUsd;
          if (t.logo) ex.logo = t.logo;  // FIX: el logo personalizado del usuario tiene prioridad
        } else {
          byAddr.set(t.address.toLowerCase(), t);
        }
      }

      return Array.from(byAddr.values()).sort((a, b) => b.balanceNum - a.balanceNum);
    },
    enabled: !!walletAddress,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
