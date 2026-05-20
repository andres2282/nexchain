'use client';

import { encodeFunctionData, parseUnits, formatUnits } from 'viem';
import { MiniKit } from '@worldcoin/minikit-js';
import { publicClient } from './viem';
import { ERC20_ABI, QUOTER_V2_ABI, SWAP_ROUTER_02_ABI } from './abis';
import { UNISWAP_V3, FEE_TIERS } from '@/config/chain';
import type { SwapToken } from '@/config/tokens';

// ============================================================
// TIPOS
// ============================================================
export type QuoteResult = {
  amountOut: bigint;
  amountOutFormatted: string;
  feeTier: number;
  rate: number;
};

// ============================================================
// QUOTE - busca el mejor pool en los 3 fee tiers
// ============================================================
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

  const best = await findBestQuote(
    tokenIn.address,
    tokenOut.address,
    amountIn
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
    rate: amountInNum > 0 ? amountOutNum / amountInNum : 0,
  };
}

// ============================================================
// CHECK ALLOWANCE - decide si necesita approve o no
// ============================================================
export async function checkAllowance(
  walletAddress: string,
  tokenAddress: string,
  amount: bigint
): Promise<boolean> {
  try {
    const allowance = (await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [
        walletAddress as `0x${string}`,
        UNISWAP_V3.SWAP_ROUTER_02 as `0x${string}`,
      ],
    })) as bigint;

    return allowance >= amount;
  } catch (err) {
    console.error('[NexChain] Allowance check failed:', err);
    return false;
  }
}

// ============================================================
// SLIPPAGE - 0.5% default
// ============================================================
function applySlippage(amountOut: bigint, slippageBps: number = 50): bigint {
  return (amountOut * BigInt(10000 - slippageBps)) / 10000n;
}

// ============================================================
// SEND TRANSACTION - helper unificado
// Convierte bigints a string y agrega timeout
// ============================================================
async function sendSingleTransaction(tx: {
  to: string;
  data: string;
  value?: string;
}): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('No estás en un navegador');
  }
  if (!MiniKit.isInstalled()) {
    throw new Error('MiniKit no está instalado. Abrí la app dentro de World App.');
  }

  // Asegurar que value sea string (no bigint)
  const safeTx = {
    to: tx.to,
    data: tx.data,
    value: tx.value || '0',
  };

  console.log('[NexChain] sendTransaction:', safeTx);

  const TIMEOUT_MS = 90_000;
  const txPromise = (MiniKit as any).commandsAsync.sendTransaction({
    transaction: [safeTx],
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            'Tiempo de espera agotado (90s). World App no respondió.'
          )
        ),
      TIMEOUT_MS
    )
  );

  const result: any = await Promise.race([txPromise, timeoutPromise]);

  console.log('[NexChain] MiniKit response:', result);

  const finalPayload = result?.finalPayload;
  if (!finalPayload) {
    throw new Error('Sin respuesta de World App');
  }

  if (finalPayload.status === 'error') {
    const errMsg =
      finalPayload.error_code ||
      finalPayload.message ||
      finalPayload.details ||
      'Transacción rechazada';
    throw new Error(errMsg);
  }

  return (
    finalPayload.transaction_id ||
    finalPayload.userOpHash ||
    finalPayload.hash ||
    ''
  );
}

// ============================================================
// STEP 1: APPROVE (transacción única)
// ============================================================
export async function executeApprove(
  tokenIn: SwapToken,
  amountInStr: string
): Promise<string> {
  const amountIn = parseUnits(amountInStr, tokenIn.decimals);

  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [
      UNISWAP_V3.SWAP_ROUTER_02 as `0x${string}`,
      amountIn,
    ],
  });

  console.log('[NexChain] APPROVE:', {
    token: tokenIn.symbol,
    spender: UNISWAP_V3.SWAP_ROUTER_02,
    amount: amountIn.toString(),
  });

  return sendSingleTransaction({
    to: tokenIn.address,
    data,
  });
}

// ============================================================
// STEP 2: SWAP (transacción única)
// ============================================================
export async function executeSwapOnly(
  walletAddress: string,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountInStr: string,
  quote: QuoteResult
): Promise<string> {
  const amountIn = parseUnits(amountInStr, tokenIn.decimals);
  const amountOutMinimum = applySlippage(quote.amountOut, 50);

  const data = encodeFunctionData({
    abi: SWAP_ROUTER_02_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: tokenIn.address as `0x${string}`,
        tokenOut: tokenOut.address as `0x${string}`,
        fee: quote.feeTier,
        recipient: walletAddress as `0x${string}`,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  console.log('[NexChain] SWAP:', {
    tokenIn: tokenIn.symbol,
    tokenOut: tokenOut.symbol,
    amountIn: amountIn.toString(),
    amountOutMinimum: amountOutMinimum.toString(),
    feeTier: quote.feeTier,
  });

  return sendSingleTransaction({
    to: UNISWAP_V3.SWAP_ROUTER_02,
    data,
  });
}
