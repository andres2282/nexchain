'use client';

import { useMemo, useState } from 'react';
import {
  Send,
  Download,
  ArrowLeftRight,
  Copy,
  Check,
  X,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { useImportedTokens } from '@/hooks/useImportedTokens';
import { TokenRowSkeleton } from './Skeletons';
import { SwapModal } from './SwapModal';
import { TokenLogo } from './TokenLogo';
import { publicClient } from '@/lib/viem';
import { ERC20_ABI } from '@/lib/abis';

export function WalletView({ walletAddress }: { walletAddress: string }) {
  const { data: tokens, isLoading, refetch } = useAllTokenBalances(walletAddress);
  const addresses = useMemo(() => tokens?.map((t) => t.address) || [], [tokens]);
  const { data: prices } = useTokenPrices(addresses);
  const [showReceive, setShowReceive] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [swapFromSymbol, setSwapFromSymbol] = useState<string | undefined>();
  const { remove: removeImported } = useImportedTokens();

  const enriched = useMemo(() => {
    if (!tokens) return [];
    return tokens
      .map((t) => {
        const p = prices?.[t.address.toLowerCase()];
        const usd = p?.usd || 0;
        const change = p?.change24h || 0;
        return { ...t, usd, change, usdValue: t.balanceNum * usd };
      })
      .sort((a, b) => b.usdValue - a.usdValue);
  }, [tokens, prices]);

  const totalUsd = enriched.reduce((s, t) => s + t.usdValue, 0);

  const openSwap = (fromSymbol?: string) => {
    setSwapFromSymbol(fromSymbol);
    setShowSwap(true);
  };

  const openSend = () => {
    alert('Para enviar tokens, usá el botón "Enviar" de tu wallet en World App');
  };

  return (
    <div className="px-4 py-5 pb-28 space-y-5 animate-fade-in">
      <div className="text-center py-2">
        <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">
          Saldo Total
        </div>
        <div className="font-cyber text-5xl font-black text-white">
          ${totalUsd.toFixed(2)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ActionBtn icon={Send} label="Enviar" onClick={openSend} />
        <ActionBtn
          icon={Download}
          label="Recibir"
          onClick={() => setShowReceive(true)}
        />
        <ActionBtn
          icon={ArrowLeftRight}
          label="Swap"
          highlight
          onClick={() => openSwap()}
        />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1 mb-1">
          <h2 className="font-cyber text-base font-bold text-white">
            Mis Tokens
          </h2>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-nex-panel border border-nex-green/30 text-xs text-nex-green active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            Importar
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <TokenRowSkeleton />
            <TokenRowSkeleton />
            <TokenRowSkeleton />
          </div>
        ) : enriched.length === 0 ? (
          <div className="text-center py-10 rounded-2xl bg-nex-panel border border-white/5">
            <div className="text-4xl mb-2">🪙</div>
            <div className="text-sm text-gray-400 mb-1">
              No detectamos tokens
            </div>
            <div className="text-xs text-gray-600 mb-4 px-6">
              Importá tokens manualmente con su dirección de contrato
            </div>
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-nex-green/10 border border-nex-green/40 text-sm text-nex-green active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" />
              Importar token
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {enriched.map((t) => (
              <TokenRow
                key={t.address}
                token={t}
                onSwap={() => openSwap(t.symbol)}
                onRemove={
                  t.isImported
                    ? () => {
                        removeImported(t.address);
                        setTimeout(() => refetch(), 100);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      {showReceive && (
        <ReceiveModal
          address={walletAddress}
          onClose={() => setShowReceive(false)}
        />
      )}

      {showImport && (
        <ImportTokenModal
          walletAddress={walletAddress}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            setTimeout(() => refetch(), 200);
          }}
        />
      )}

      {showSwap && (
        <SwapModal
          walletAddress={walletAddress}
          initialFromSymbol={swapFromSymbol}
          onClose={() => {
            setShowSwap(false);
            setTimeout(() => refetch(), 500);
          }}
        />
      )}
    </div>
  );
}

function TokenRow({
  token,
  onSwap,
  onRemove,
}: {
  token: any;
  onSwap?: () => void;
  onRemove?: () => void;
}) {
  const isUp = token.change >= 0;
  return (
    <div className="rounded-2xl bg-nex-panel border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between p-3">
        <button
          onClick={onSwap}
          className="flex items-center gap-3 min-w-0 flex-1 active:scale-[0.98] transition-transform"
        >
          <TokenLogo symbol={token.symbol} logo={token.logo} size="lg" />
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-white text-sm">{token.symbol}</span>
              {token.symbol === 'NXCH' && (
                <Sparkles className="w-3 h-3 text-nex-green" />
              )}
              {token.isImported && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-nex-green/15 text-nex-green border border-nex-green/30">
                  IMPORTADO
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 font-mono">
              {token.balanceNum.toLocaleString('en-US', {
                maximumFractionDigits: 4,
              })}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="font-bold text-white text-sm">
              ${token.usdValue.toFixed(2)}
            </div>
            {token.change !== 0 && (
              <div className={`text-xs ${isUp ? 'text-nex-green' : 'text-red-400'}`}>
                {isUp ? '+' : ''}
                {token.change.toFixed(2)}%
              </div>
            )}
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 active:scale-95 transition-transform"
              aria-label="Quitar token"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {token.lowLiquidity && token.isImported && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border-t border-orange-500/20">
          <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0" />
          <span className="text-[10px] text-orange-300 leading-tight">
            Baja liquidez
            {token.liquidityUsd ? ` ($${Math.round(token.liquidityUsd)})` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  highlight,
  onClick,
}: {
  icon: any;
  label: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border transition-all active:scale-95 ${
        highlight
          ? 'bg-gradient-to-br from-nex-green/20 to-nex-cyan/10 border-nex-green/40 shadow-glow-green'
          : 'bg-nex-panel border-white/10'
      }`}
    >
      <Icon className={`w-5 h-5 ${highlight ? 'text-nex-green' : 'text-white'}`} />
      <span className="text-[11px] text-white font-medium">{label}</span>
    </button>
  );
}

function ReceiveModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&bgcolor=0B1525&color=00FF88&margin=8&data=${encodeURIComponent(address)}`;

  return (
    <div className="fixed inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-end animate-fade-in" onClick={onClose}>
      <div
        className="w-full bg-nex-bg border-t border-white/10 rounded-t-3xl p-5 space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-12 h-1 rounded-full bg-white/20 mx-auto" />
        <div className="flex items-center justify-between">
          <h3 className="font-cyber text-lg font-bold text-white">Recibir tokens</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-nex-panel flex items-center justify-center">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="bg-nex-panel rounded-2xl p-4 flex flex-col items-center gap-3 border border-white/10">
          <div className="rounded-xl overflow-hidden bg-nex-panel p-2">
            <img src={qrUrl} alt="QR" width={240} height={240} />
          </div>
          <div className="text-xs text-gray-400 text-center">
            Escaneá este QR o copiá tu dirección
          </div>
        </div>
        <button
          onClick={copy}
          className="w-full p-3 rounded-2xl bg-nex-panel border border-nex-green/30 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <span className="font-mono text-xs text-white truncate flex-1 text-left">{address}</span>
          {copied ? (
            <Check className="w-4 h-4 text-nex-green shrink-0 ml-2" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
          )}
        </button>
        <p className="text-[11px] text-center text-gray-500 leading-relaxed">
          Solo recibí tokens en <span className="text-nex-green">World Chain</span>. Enviar desde otras redes puede resultar en pérdida.
        </p>
      </div>
    </div>
  );
}

function ImportTokenModal({
  walletAddress,
  onClose,
  onImported,
}: {
  walletAddress: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [addressInput, setAddressInput] = useState('');
  const [logoInput, setLogoInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ symbol: string; decimals: number } | null>(null);
  const { add } = useImportedTokens();

  const validate = async () => {
    setError(null);
    setPreview(null);
    const addr = addressInput.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setError('Dirección inválida. Tiene que empezar con 0x y tener 42 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: addr as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }) as Promise<string>,
        publicClient.readContract({
          address: addr as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }) as Promise<number>,
      ]);
      setPreview({ symbol, decimals });
    } catch (err) {
      setError('No se pudo leer el token. ¿Es un contrato ERC-20 en World Chain?');
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = () => {
    const addr = addressInput.trim();
    const logo = logoInput.trim() || undefined;

    // Validacion basica de URL del logo
    if (logo && !/^https?:\/\//i.test(logo)) {
      setError('La URL del logo debe empezar con http:// o https://');
      return;
    }

    if (add(addr, logo)) {
      // Cerrar modal silenciosamente, sin mensaje "agregado"
      onImported();
    } else {
      setError('Dirección inválida');
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-end animate-fade-in" onClick={onClose}>
      <div
        className="w-full bg-nex-bg border-t border-white/10 rounded-t-3xl p-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-12 h-1 rounded-full bg-white/20 mx-auto" />
        <div className="flex items-center justify-between">
          <h3 className="font-cyber text-lg font-bold text-white">Importar token</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-nex-panel flex items-center justify-center">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Dirección del contrato (World Chain)</label>
          <input
            value={addressInput}
            onChange={(e) => {
              setAddressInput(e.target.value);
              setPreview(null);
              setError(null);
            }}
            placeholder="0x..."
            className="w-full px-3 py-3 rounded-xl bg-nex-panel border border-white/10 text-sm text-white placeholder:text-gray-500 font-mono focus:border-nex-green/40 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">
            URL del logo <span className="text-gray-600">(opcional)</span>
          </label>
          <input
            value={logoInput}
            onChange={(e) => {
              setLogoInput(e.target.value);
              setError(null);
            }}
            placeholder="https://..."
            className="w-full px-3 py-3 rounded-xl bg-nex-panel border border-white/10 text-sm text-white placeholder:text-gray-500 focus:border-nex-green/40 focus:outline-none"
          />
          {logoInput && /^https?:\/\//i.test(logoInput) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nex-panel/50 border border-white/5">
              <span className="text-[10px] text-gray-500">Vista previa:</span>
              <img
                src={logoInput}
                alt="logo preview"
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 leading-relaxed">
            {error}
          </div>
        )}

        {preview && (
          <div className="p-3 rounded-xl bg-nex-green/10 border border-nex-green/30 space-y-1">
            <div className="text-xs text-gray-400">Token detectado:</div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">{preview.symbol}</span>
              <span className="text-xs text-gray-400">{preview.decimals} decimales</span>
            </div>
          </div>
        )}

        {!preview ? (
          <button
            onClick={validate}
            disabled={loading || !addressInput}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-nex-green to-nex-cyan text-black font-cyber font-black disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar token'
            )}
          </button>
        ) : (
          <button
            onClick={confirmImport}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-nex-green to-nex-cyan text-black font-cyber font-black active:scale-[0.98] transition-transform"
          >
            Importar {preview.symbol}
          </button>
        )}

        <p className="text-[11px] text-center text-gray-500 leading-relaxed">
          Solo importá tokens de contratos verificados. Los tokens importados son privados (solo vos los ves).
        </p>
      </div>
    </div>
  );
}
