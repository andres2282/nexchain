'use client';

import { encodeFunctionData, parseUnits, formatUnits, maxUint256 } from 'viem';
import { MiniKit } from '@worldcoin/minikit-js';
import { publicClient } from './viem';
import { ERC20_ABI, QUOTER_V2_ABI, SWAP_ROUTER_02_ABI } from './abis';
import {
  UNISWAP_V3,
  FEE_TIERS,
  FEE_RECEIVER,
  SWAP_FEE_BPS,
  SWAP_FEE_DISCOUNTED_BPS,
} from '@/config/chain';
import { NXCH_ADDRESS, type SwapToken } from '@/config/tokens';

// ============================================================
// TIPOS
// ============================================================
export type QuoteResult = {
  amountOut: bigint;
  amountOutFormatted: string;
  feeTier: number;
  feeBps: number;
  feeAmount: bigint;
  feeAmountFormatted: string;
  netAmountIn: bigint;
  hasDiscount: boolean;
  rate: number;
};

// ============================================================
// NXCH DISCOUNT CHECK
// ============================================================
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

// ============================================================
// FIND BEST POOL (probar los 3 fee tiers)
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

// ============================================================
// QUOTE
// ============================================================
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

  // Calcular fee y monto neto a swapear
  const feeAmount = (amountIn * BigInt(feeBps)) / 10000n;
  const netAmountIn = amountIn - feeAmount;

  // Pedir cotización por el monto NETO (después del fee)
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

// ============================================================
// SWAP EXECUTION
// Sigue el patron OFICIAL de World docs:
// https://docs.world.org/mini-apps/commands/send-transaction
// ============================================================

// Slippage: 0.5% default
function applySlippage(amountOut: bigint, slippageBps: number = 50): bigint {
  return (amountOut * BigInt(10000 - slippageBps)) / 10000n;
}

const PERMIT2 = UNISWAP_V3.PERMIT2;

// ABI de Permit2 approve (allowance transfer)
const PERMIT2_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export type SwapResult = {
  txHash: string;
  success: boolean;
};

export async function executeSwap(
  walletAddress: string,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountInStr: string,
  quote: QuoteResult
): Promise<SwapResult> {
  const amountIn = parseUnits(amountInStr, tokenIn.decimals);
  const amountOutMinimum = applySlippage(quote.amountOut, 50); // 0.5% slippage

  // Construir array de transacciones segun el patron oficial de World
  const transactions: any[] = [];

  // 1. Approve ERC-20 normal al SwapRouter (no Permit2)
  // Las nuevas versiones de MiniKit (v2+) permiten approve estandar
  transactions.push({
    to: tokenIn.address,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [UNISWAP_V3.SWAP_ROUTER_02 as `0x${string}`, amountIn],
    }),
  });

  // 2. exactInputSingle al SwapRouter02 - swapeamos el monto COMPLETO
  // (no separamos fee por ahora para simplificar)
  transactions.push({
    to: UNISWAP_V3.SWAP_ROUTER_02,
    data: encodeFunctionData({
      abi: SWAP_ROUTER_02_ABI,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: tokenIn.address as `0x${string}`,
          tokenOut: tokenOut.address as `0x${string}`,
          fee: quote.feeTier,
          recipient: walletAddress as `0x${string}`,
          amountIn: amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: 0n,
        },
      ],
    }),
  });

  // Enviar todas las transacciones en un solo sendTransaction
  // MiniKit 1.9.6 usa "transaction" (sin S) y "to" en cada item

  // Timeout para no colgarse para siempre
  const TIMEOUT_MS = 90_000; // 90 segundos
  const txPromise = (MiniKit as any).commandsAsync.sendTransaction({
    transaction: transactions,
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            'Tiempo de espera agotado. World App no respondió. Verificá tu conexión.'
          )
        ),
      TIMEOUT_MS
    )
  );

  const result: any = await Promise.race([txPromise, timeoutPromise]);

  const finalPayload = result?.finalPayload;

  if (!finalPayload) {
    throw new Error('No hubo respuesta de World App');
  }

  if (finalPayload.status === 'error') {
    const errMsg =
      finalPayload.error_code ||
      finalPayload.message ||
      finalPayload.details ||
      'Transacción rechazada';
    throw new Error(errMsg);
  }

  return {
    txHash:
      finalPayload.transaction_id ||
      finalPayload.userOpHash ||
      finalPayload.hash ||
      '',
    success: true,
  };
}
