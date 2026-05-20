'use client';

import { parseUnits, formatUnits } from 'viem';
import { MiniKit } from '@worldcoin/minikit-js';
import { Client, Multicall3, Quoter, SwapHelper } from '@holdstation/worldchain-viem';
import { config, inmemoryTokenStorage } from '@holdstation/worldchain-sdk';
import { publicClient } from './viem';
import { ERC20_ABI } from './abis';
import {
  FEE_RECEIVER,
  SWAP_FEE_PERCENT,
  SWAP_FEE_DISCOUNTED_PERCENT,
} from '@/config/chain';
import { NXCH_ADDRESS, type SwapToken } from '@/config/tokens';

// ============================================================
// Setup del cliente Holdstation (singleton lazy)
// ============================================================
let _client: Client | null = null;
let _swapHelper: SwapHelper | null = null;

function getClient(): Client {
  if (!_client) {
    _client = new Client(publicClient);
    config.client = _client;
    config.multicall3 = new Multicall3(publicClient);
  }
  return _client;
}

function getSwapHelper(): SwapHelper {
  if (!_swapHelper) {
    const client = getClient();
    _swapHelper = new SwapHelper(client, {
      tokenStorage: inmemoryTokenStorage,
    });
  }
  return _swapHelper;
}

// ============================================================
// Detección de descuento NXCH
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
// Quote (cotización)
// ============================================================
export type QuoteResult = {
  amountOut: string;
  amountOutFormatted: string;
  rate: number;
  feePercent: string;
  hasDiscount: boolean;
  // Datos crudos para ejecutar el swap
  rawQuote: any;
};

export async function getSwapQuote(
  walletAddress: string,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountInStr: string
): Promise<QuoteResult | null> {
  if (!amountInStr || parseFloat(amountInStr) <= 0) return null;
  if (tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()) return null;

  // Detectar descuento por NXCH
  const hasDiscount = await hasNxchDiscount(walletAddress);
  const feePercent = hasDiscount
    ? SWAP_FEE_DISCOUNTED_PERCENT
    : SWAP_FEE_PERCENT;

  try {
    const swapHelper = getSwapHelper();

    const params = {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountIn: amountInStr,
      slippage: '0.5', // 0.5% slippage default
      fee: feePercent,
    };

    const quote: any = await swapHelper.quote(params);

    if (!quote) return null;

    // Parsear amount out
    const amountOutRaw =
      quote.outAmount || quote.amountOut || quote.outputAmount || '0';
    const amountOutFormatted = formatUnits(
      BigInt(amountOutRaw),
      tokenOut.decimals
    );

    const amountInNum = parseFloat(amountInStr);
    const amountOutNum = parseFloat(amountOutFormatted);
    const rate = amountInNum > 0 ? amountOutNum / amountInNum : 0;

    return {
      amountOut: amountOutRaw.toString(),
      amountOutFormatted,
      rate,
      feePercent,
      hasDiscount,
      rawQuote: quote,
    };
  } catch (err: any) {
    console.error('Quote error:', err?.message || err);
    return null;
  }
}

// ============================================================
// Ejecutar swap
// ============================================================
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
  const swapHelper = getSwapHelper();

  const swapParams = {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    amountIn: amountInStr,
    slippage: '0.5',
    fee: quote.feePercent,
    feeReceiver: FEE_RECEIVER,
    // Datos del quote
    tx: {
      data: quote.rawQuote.data,
      to: quote.rawQuote.to,
      value: quote.rawQuote.value || '0',
    },
    feeAmountOut: quote.rawQuote.addons?.feeAmountOut,
  };

  // El SDK arma la transacción, pero la firmamos con MiniKit
  // (porque estamos dentro de World App)
  const minikitTx = {
    address: swapParams.tx.to as `0x${string}`,
    abi: [], // Usa data raw, no abi
    functionName: '',
    args: [],
    data: swapParams.tx.data,
    value: swapParams.tx.value?.toString() || '0',
  };

  const result: any = await (MiniKit as any).commandsAsync.sendTransaction({
    transaction: [minikitTx],
  });

  const finalPayload = result?.finalPayload;
  if (!finalPayload || finalPayload.status === 'error') {
    throw new Error(finalPayload?.message || 'Swap cancelado');
  }

  return {
    txHash: finalPayload.transaction_id || '',
    success: true,
  };
}
