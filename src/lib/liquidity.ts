'use client';

import { publicClient } from './viem';
import { UNISWAP_V3, FEE_TIERS } from '@/config/chain';
import { ERC20_ABI } from './abis';

// Direcciones de tokens "anchor" para chequear liquidez (USDC, WLD, WETH)
const ANCHOR_TOKENS = [
  '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1', // USDC
  '0x2cFc85d8E48F8EAB294be644d9E25C3030863003', // WLD
  '0x4200000000000000000000000000000000000006', // WETH
] as const;

// ABI minima de UniswapV3Factory.getPool
const FACTORY_ABI = [
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const;

// Precio aproximado de USD por token anchor (placeholder, en produccion usar oracle)
// Se usan estos para estimar TVL en USD desde el balance de tokens en el pool
const ANCHOR_USD_PRICE: Record<string, number> = {
  '0x79a02482a880bce3f13e09da970dc34db4cd24d1': 1.0, // USDC
  '0x2cfc85d8e48f8eab294be644d9e25c3030863003': 2.5, // WLD (aprox)
  '0x4200000000000000000000000000000000000006': 3000.0, // WETH (aprox)
};

const ANCHOR_DECIMALS: Record<string, number> = {
  '0x79a02482a880bce3f13e09da970dc34db4cd24d1': 6,
  '0x2cfc85d8e48f8eab294be644d9e25c3030863003': 18,
  '0x4200000000000000000000000000000000000006': 18,
};

// Cache en memoria (10 min)
const liquidityCache = new Map<string, { tvl: number; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// Estima TVL en USD del mejor pool que tiene el token con un anchor (USDC/WLD/WETH)
// Retorna 0 si no encuentra ningun pool
export async function estimateTokenLiquidity(
  tokenAddress: string
): Promise<number> {
  const key = tokenAddress.toLowerCase();

  // Check cache
  const cached = liquidityCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.tvl;
  }

  let maxTvl = 0;

  // Probar contra cada anchor token y cada fee tier
  for (const anchor of ANCHOR_TOKENS) {
    if (anchor.toLowerCase() === key) continue; // no chequear contra si mismo

    for (const feeTier of FEE_TIERS) {
      try {
        // 1. Buscar la direccion del pool
        const poolAddress = (await publicClient.readContract({
          address: UNISWAP_V3.FACTORY as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: 'getPool',
          args: [
            tokenAddress as `0x${string}`,
            anchor as `0x${string}`,
            feeTier,
          ],
        })) as string;

        // Pool no existe (address 0x0)
        if (
          !poolAddress ||
          poolAddress === '0x0000000000000000000000000000000000000000'
        ) {
          continue;
        }

        // 2. Leer balance del anchor token en el pool
        const anchorBalance = (await publicClient.readContract({
          address: anchor as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [poolAddress as `0x${string}`],
        })) as bigint;

        // 3. Convertir a USD
        const anchorKey = anchor.toLowerCase();
        const decimals = ANCHOR_DECIMALS[anchorKey];
        const priceUsd = ANCHOR_USD_PRICE[anchorKey];

        if (!decimals || !priceUsd) continue;

        const divisor = BigInt(10) ** BigInt(decimals);
        const wholeBalance = Number(anchorBalance / divisor);
        const fracBalance =
          Number(anchorBalance % divisor) / Number(divisor);
        const anchorBalanceNum = wholeBalance + fracBalance;

        // TVL aproximado = 2 * balance del anchor (asumiendo paridad de valor en el pool)
        const tvl = anchorBalanceNum * priceUsd * 2;

        if (tvl > maxTvl) {
          maxTvl = tvl;
        }
      } catch {
        // Pool no existe o error de RPC, seguir con el siguiente
      }
    }
  }

  // Cache result
  liquidityCache.set(key, { tvl: maxTvl, timestamp: Date.now() });

  return maxTvl;
}

// Chequea si un token tiene liquidez minima (default $500)
export async function hasMinLiquidity(
  tokenAddress: string,
  minUsd: number = 500
): Promise<boolean> {
  const tvl = await estimateTokenLiquidity(tokenAddress);
  return tvl >= minUsd;
}

// Limpia el cache (util para tests o forzar refresh)
export function clearLiquidityCache(): void {
  liquidityCache.clear();
}
