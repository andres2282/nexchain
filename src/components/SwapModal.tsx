'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ChevronDown,
  X,
  Loader2,
  Check,
  ExternalLink,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { MiniKit } from '@worldcoin/minikit-js';
import {
  SWAP_TOKENS,
  type SwapToken,
} from '@/config/tokens';
import {
  WORLDCHAIN,
  SWAP_FEE_PERCENT,
  SWAP_FEE_DISCOUNTED_PERCENT,
} from '@/config/chain';
import {
  getSwapQuote,
  executeSwap,
  type QuoteResult,
} from '@/lib/uniswap';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { TokenLogo } from './TokenLogo';

type SwapStatus = 'idle' | 'quoting' | 'swapping' | 'success' | 'error';

export function SwapModal({
  walletAddress,
  initialFromSymbol,
  onClose,
}: {
  walletAddress: string;
  initialFromSymbol?: string;
  onClose: () => void;
}) {
  const initialFrom =
    SWAP_TOKENS.find(
      (t) => t.symbol.toLowerCase() === (initialFromSymbol || 'wld').toLowerCase()
    ) || SWAP_TOKENS[0];
  const initialTo =
    SWAP_TOKENS.find(
      (t) =>
        t.symbol === 'USDC' &&
        t.address.toLowerCase() !== initialFrom.address.toLowerCase()
    ) ||
    SWAP_TOKENS.find(
      (t) => t.address.toLowerCase() !== initialFrom.address.toLowerCase()
    ) ||
    SWAP_TOKENS[1];

  const [from, setFrom] = useState<SwapToken>(initialFrom);
  const [to, setTo] = useState<SwapToken>(initialTo);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showFromList, setShowFromList] = useState(false);
  const [showToList, setShowToList] = useState(false);
  const [slippage] = useState(50); // 0.5%

  const { data: balances } = useAllTokenBalances(walletAddress);

  const fromBalance = useMemo(() => {
    return balances?.find(
      (b) => b.address.toLowerCase() === from.address.toLowerCase()
    );
  }, [balances, from]);

  // Debounced quote
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      setError(null);
      return;
    }

    const id = setTimeout(async () => {
      setStatus('quoting');
      setError(null);
      try {
        const q = await getSwapQuote(walletAddress, from, to, amount);
        if (!q) {
          setError('No hay liquidez suficiente para este par');
          setQuote(null);
        } else {
          setQuote(q);
        }
      } catch (err: any) {
        setError(err?.message || 'Error al cotizar');
        setQuote(null);
      } finally {
        setStatus((s) => (s === 'quoting' ? 'idle' : s));
      }
    }, 500);

    return () => clearTimeout(id);
  }, [amount, from, to, walletAddress]);

  const swap = async () => {
    if (!quote) return;
    setError(null);
    setStatus('swapping');

    try {
      const result = await executeSwap(
        walletAddress,
        from,
        to,
        amount,
        quote
      );

      setTxHash(result.txHash);
      setStatus('success');
    } catch (err: any) {
      console.error('Swap error:', err);
      const errMsg =
        err?.message || err?.toString() || 'No se pudo completar el swap';
      setError(errMsg);
      setStatus('error');
    }
  };

  const swapTokens = () => {
    const temp = from;
    setFrom(to);
    setTo(temp);
    setAmount('');
    setQuote(null);
  };

  const setMaxAmount = () => {
    if (fromBalance) {
      const max = Math.max(0, fromBalance.balanceNum - 0.0001);
      setAmount(max.toString());
    }
  };

  const isInsufficientBalance =
    fromBalance && quote
      ? parseFloat(amount) > fromBalance.balanceNum
      : false;

  const canSwap =
    quote &&
    !isInsufficientBalance &&
    status !== 'swapping' &&
    status !== 'quoting' &&
    parseFloat(amount) > 0;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full bg-nex-bg border-t border-white/10 rounded-t-3xl p-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-12 h-1 rounded-full bg-white/20 mx-auto" />

        <div className="flex items-center justify-between">
          <h3 className="font-cyber text-xl font-black text-white">SWAP</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-nex-panel flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="py-8 flex flex-col items-center text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-nex-green/20 flex items-center justify-center shadow-glow-green">
              <Check className="w-8 h-8 text-nex-green" />
            </div>
            <div>
              <div className="text-xl font-cyber font-bold text-white">
                ¡Swap completado!
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {amount} {from.symbol} → {quote?.amountOutFormatted.slice(0, 8)}{' '}
                {to.symbol}
              </div>
            </div>
            {txHash && (
              <a
                href={`${WORLDCHAIN.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-nex-cyan"
              >
                Ver en explorador
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-nex-green to-nex-cyan text-black font-cyber font-black"
            >
              CERRAR
            </button>
          </div>
        ) : (
          <>
            {/* FROM box */}
            <div className="rounded-2xl bg-nex-panel border border-white/10 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  Desde
                </span>
                {fromBalance && (
                  <button
                    onClick={setMaxAmount}
                    className="text-[11px] text-gray-400 active:scale-95"
                  >
                    Saldo:{' '}
                    <span className="text-nex-green font-mono">
                      {fromBalance.balanceNum.toLocaleString('en-US', {
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 bg-transparent text-2xl font-cyber font-bold text-white outline-none min-w-0"
                />
                <TokenButton
                  token={from}
                  onClick={() => setShowFromList(true)}
                />
              </div>
            </div>

            {/* Switch */}
            <div className="flex justify-center -my-2 relative z-10">
              <button
                onClick={swapTokens}
                className="w-9 h-9 rounded-full bg-nex-panel border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
              >
                <ArrowDown className="w-4 h-4 text-nex-green" />
              </button>
            </div>

            {/* TO box */}
            <div className="rounded-2xl bg-nex-panel border border-white/10 p-4 space-y-2">
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                Recibís
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-2xl font-cyber font-bold text-white truncate min-w-0">
                  {status === 'quoting' ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                  ) : quote ? (
                    parseFloat(quote.amountOutFormatted).toLocaleString(
                      'en-US',
                      { maximumFractionDigits: 6 }
                    )
                  ) : (
                    '0.0'
                  )}
                </div>
                <TokenButton token={to} onClick={() => setShowToList(true)} />
              </div>
            </div>

            {/* Quote details */}
            {quote && (
              <div className="rounded-xl bg-nex-panel/60 border border-white/5 p-3 space-y-1.5 text-xs">
                <Row
                  label="Tasa"
                  value={`1 ${from.symbol} = ${quote.rate.toFixed(6)} ${to.symbol}`}
                />
                <Row
                  label="Fee NexChain"
                  value={
                    <span className="flex items-center gap-1">
                      {quote.hasDiscount && (
                        <Sparkles className="w-3 h-3 text-nex-green" />
                      )}
                      {(quote.hasDiscount
                        ? SWAP_FEE_DISCOUNTED_PERCENT
                        : SWAP_FEE_PERCENT)}%
                      {quote.hasDiscount && (
                        <span className="text-[9px] text-nex-green ml-1">
                          (descuento NXCH)
                        </span>
                      )}
                    </span>
                  }
                />
                <Row label="Slippage" value={`${(slippage / 100).toFixed(2)}%`} />
                {!quote.hasDiscount && (
                  <div className="mt-2 p-2 rounded-lg bg-nex-green/10 border border-nex-green/30 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-nex-green shrink-0" />
                    <span className="text-[10px] text-gray-300 leading-tight">
                      Tené NXCH y pagá solo 0.1% de fee en cada swap
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-950/40 border border-red-500/30 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="text-xs text-red-300 leading-relaxed">
                  {error}
                </span>
              </div>
            )}

            {/* Insufficient balance */}
            {isInsufficientBalance && (
              <div className="rounded-xl bg-orange-950/40 border border-orange-500/30 p-3 text-xs text-orange-300">
                Saldo insuficiente de {from.symbol}
              </div>
            )}

            {/* Swap button */}
            <button
              onClick={swap}
              disabled={!canSwap}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-nex-green to-nex-cyan text-black font-cyber font-black text-base shadow-glow-green active:scale-[0.98] transition-transform disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {status === 'swapping' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : status === 'quoting' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cotizando...
                </>
              ) : isInsufficientBalance ? (
                'SALDO INSUFICIENTE'
              ) : !quote && amount ? (
                'SIN LIQUIDEZ'
              ) : !amount ? (
                'INGRESÁ UN MONTO'
              ) : (
                `SWAP ${from.symbol} → ${to.symbol}`
              )}
            </button>

            <p className="text-[10px] text-center text-gray-500 leading-relaxed">
              Los swaps se ejecutan en Uniswap V3 sobre World Chain.
              <br />
              NexChain cobra un fee del 0.3% (0.1% con NXCH).
            </p>
          </>
        )}

        {showFromList && (
          <TokenListModal
            current={from}
            exclude={to}
            balances={balances}
            onSelect={(t) => {
              setFrom(t);
              setShowFromList(false);
              setAmount('');
            }}
            onClose={() => setShowFromList(false)}
          />
        )}

        {showToList && (
          <TokenListModal
            current={to}
            exclude={from}
            balances={balances}
            onSelect={(t) => {
              setTo(t);
              setShowToList(false);
            }}
            onClose={() => setShowToList(false)}
          />
        )}
      </div>
    </div>
  );
}

function TokenButton({
  token,
  onClick,
}: {
  token: SwapToken;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-nex-bg border border-white/15 active:scale-95 transition-transform shrink-0"
    >
      <TokenLogo symbol={token.symbol} logo={token.logo} size="sm" />
      <span className="font-bold text-white text-sm">{token.symbol}</span>
      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function TokenListModal({
  current,
  exclude,
  balances,
  onSelect,
  onClose,
}: {
  current: SwapToken;
  exclude: SwapToken;
  balances?: any[];
  onSelect: (t: SwapToken) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full bg-nex-bg border-t border-white/10 rounded-t-3xl p-5 space-y-3 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-12 h-1 rounded-full bg-white/20 mx-auto" />
        <div className="flex items-center justify-between">
          <h3 className="font-cyber text-base font-bold text-white">
            Seleccionar token
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-nex-panel flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {SWAP_TOKENS.filter(
            (t) => t.address.toLowerCase() !== exclude.address.toLowerCase()
          ).map((t) => {
            const balance = balances?.find(
              (b) => b.address.toLowerCase() === t.address.toLowerCase()
            );
            const isCurrent =
              t.address.toLowerCase() === current.address.toLowerCase();
            return (
              <button
                key={t.address}
                onClick={() => onSelect(t)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors active:scale-[0.98] ${
                  isCurrent
                    ? 'bg-nex-green/10 border-nex-green/40'
                    : 'bg-nex-panel border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <TokenLogo symbol={t.symbol} logo={t.logo} size="md" />
                  <div className="text-left">
                    <div className="font-bold text-white text-sm flex items-center gap-1">
                      {t.symbol}
                      {t.symbol === 'NXCH' && (
                        <Sparkles className="w-3 h-3 text-nex-green" />
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500">{t.name}</div>
                  </div>
                </div>
                {balance && balance.balanceNum > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-white font-mono">
                      {balance.balanceNum.toLocaleString('en-US', {
                        maximumFractionDigits: 4,
                      })}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
