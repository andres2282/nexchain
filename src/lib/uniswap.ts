'use client';

import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { publicClient } from './viem';
import {
  ERC20_ABI,
  QUOTER_V2_ABI,
  SWAP_ROUTER_02_ABI,
} from './abis';
import {
  UNISWAP_V3,
  FEE_TIERS,
  FEE_RECEIVER,
  SWAP_FEE_BPS,
  SWAP_FEE_DISCOUNTED_BPS,
} from '@/config/chain';
import { NXCH_ADDRESS, type SwapToken } from '@/config/tokens';

export type QuoteResult = {
  amountOut: bigint;
  amountOutFormatted: string;
  feeTier: number;
  feeBps: number;
  feeAmount: bigint;
  feeAmountFormatted: string;
  netAmountIn: bigint;
  hasDiscount: boolean;
  rate: number; // 1 tokenIn = X tokenOut
};

// Detecta si el wallet tiene NXCH para aplicar descuento
export async function hasNxchDiscount(walletAddress: string): Promise<boolean> {
  try {
    const balance = (await publicClient.readContract({
      address: NXCH_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    })) as bigint;
    return balance > 0n;
  } catch {
    return false;
  }
}

// Prueba los 3 fee tiers de Uniswap V3 y elige el mejor pool
async function findBestQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint
): Promise<{ amountOut: bigint; feeTier: number } | null> {
  let best: { amountOut: bigint; feeTier: number } | null = null;

  await Promise.all(
    FEE_TIERS.map(async (feeTier) => {
      try {
        const { result } = await publicClient.simulateContract({
          address: UNISWAP_V3.QUOTER_V2 as `0x${string}`,
          abi: QUOTER_V2_ABI,
          functionName: 'quoteExactInputSingle',
          args: [
            {
              tokenIn: tokenIn as `0x${string}`,
              tokenOut: tokenOut as `0x${string}`,
              amountIn,
              fee: feeTier,
              sqrtPriceLimitX96: 0n,
            },
          ],
        });

        const amountOut = result[0] as bigint;

        if (!best || amountOut > best.amountOut) {
          best = { amountOut, feeTier };
        }
      } catch {
        // Pool no existe en este fee tier
      }
    })
  );

  return best;
}

// Cotización completa con fee y descuento aplicados
export async function getSwapQuote(
  walletAddress: string,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountInStr: string
): Promise<QuoteResult | null> {
  if (!amountInStr || parseFloat(amountInStr) <= 0) return null;
  if (tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase())
    return null;

  let amountIn: bigint;
  try {
    amountIn = parseUnits(amountInStr, tokenIn.decimals);
  } catch {
    return null;
  }

  if (amountIn === 0n) return null;

  // Verificar descuento por NXCH
  const hasDiscount = await hasNxchDiscount(walletAddress);
  const feeBps = hasDiscount ? SWAP_FEE_DISCOUNTED_BPS : SWAP_FEE_BPS;

  // Calcular fee y monto neto
  const feeAmount = (amountIn * BigInt(feeBps)) / 10000n;
  const netAmountIn = amountIn - feeAmount;

  // Pedir cotización
  const best = await findBestQuote(
    tokenIn.address,
    tokenOut.address,
    netAmountIn
  );

  if (!best) return null;

  const amountInNum = parseFloat(formatUnits(amountIn, tokenIn.decimals));
  const amountOutNum = parseFloat(
    formatUnits(best.amountOut, tokenOut.decimals)
  );

  return {
    amountOut: best.amountOut,
    amountOutFormatted: formatUnits(best.amountOut, tokenOut.decimals),
    feeTier: best.feeTier,
    feeBps,
    feeAmount,
    feeAmountFormatted: formatUnits(feeAmount, tokenIn.decimals),
    netAmountIn,
    hasDiscount,
    rate: amountInNum > 0 ? amountOutNum / amountInNum : 0,
  };
}

// Aplica slippage al amountOut para get amountOutMinimum
export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  return (amountOut * BigInt(10000 - slippageBps)) / 10000n;
}

// Construye las transacciones del swap.
// Devuelve un array de transactions para enviar via MiniKit.sendTransaction
export type SwapTransaction = {
  address: `0x${string}`;
  abi: any;
  functionName: string;
  args: any[];
};

export async function buildSwapTransactions(
  walletAddress: string,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  quote: QuoteResult,
  slippageBps: number = 50 // 0.5% default
): Promise<SwapTransaction[]> {
  const txs: SwapTransaction[] = [];

  // 1. Transfer del fee al wallet de NexChain
  if (quote.feeAmount > 0n) {
    txs.push({
      address: tokenIn.address,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [FEE_RECEIVER, quote.feeAmount],
    });
  }

  // 2. Approve del SwapRouter si no hay allowance suficiente
  try {
    const allowance = (await publicClient.readContract({
      address: tokenIn.address,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [
        walletAddress as `0x${string}`,
        UNISWAP_V3.SWAP_ROUTER_02 as `0x${string}`,
      ],
    })) as bigint;

    if (allowance < quote.netAmountIn) {
      txs.push({
        address: tokenIn.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [UNISWAP_V3.SWAP_ROUTER_02, maxUint256],
      });
    }
  } catch (err) {
    // Si falla el read, agregar approve por las dudas
    txs.push({
      address: tokenIn.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [UNISWAP_V3.SWAP_ROUTER_02, maxUint256],
    });
  }

  // 3. exactInputSingle al SwapRouter02
  const amountOutMinimum = applySlippage(quote.amountOut, slippageBps);
  txs.push({
    address: UNISWAP_V3.SWAP_ROUTER_02 as `0x${string}`,
    abi: SWAP_ROUTER_02_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fee: quote.feeTier,
        recipient: walletAddress,
        amountIn: quote.netAmountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  return txs;
}
