'use client';

import { ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import {
  useTransactionHistory,
  type Transaction,
} from '@/hooks/useTransactionHistory';
import { TokenRowSkeleton } from './Skeletons';
import { WORLDCHAIN } from '@/config/chain';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return `${mo}m`;
}

export function HistoryView({ walletAddress }: { walletAddress: string }) {
  const { data: txs, isLoading } = useTransactionHistory(walletAddress);

  return (
    <div className="px-4 py-5 pb-28 space-y-4 animate-fade-in">
      <div>
        <h1 className="font-cyber text-2xl font-black text-white">Historial</h1>
        <p className="text-xs text-gray-400 mt-1">
          Transacciones recientes en World Chain
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <TokenRowSkeleton />
          <TokenRowSkeleton />
          <TokenRowSkeleton />
          <TokenRowSkeleton />
        </div>
      ) : !txs || txs.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-nex-panel border border-white/5">
          <div className="text-4xl mb-2">📭</div>
          <div className="text-sm text-gray-400">Sin transacciones</div>
          <div className="text-xs text-gray-600 mt-1">
            Tus movimientos aparecerán acá
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {txs.map((tx) => (
            <TxRow key={tx.hash} tx={tx} />
          ))}
        </div>
      )}
    </div>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const isReceive = tx.type === 'receive';
  const amount = parseFloat(tx.amount);

  return (
    <a
      href={`${WORLDCHAIN.explorer}/tx/${tx.hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-2xl bg-nex-panel border border-white/5 active:scale-[0.98] transition-transform"
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isReceive
            ? 'bg-nex-green/20 text-nex-green'
            : 'bg-orange-500/20 text-orange-400'
        }`}
      >
        {isReceive ? (
          <ArrowDownLeft className="w-5 h-5" />
        ) : (
          <ArrowUpRight className="w-5 h-5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-white text-sm">
            {isReceive ? 'Recibido' : 'Enviado'}
          </span>
          <span className="text-xs text-gray-500">·</span>
          <span className="text-xs text-gray-500">{timeAgo(tx.timestamp)}</span>
        </div>
        <div className="text-xs text-gray-400 font-mono truncate">
          {isReceive
            ? `de ${tx.from.slice(0, 6)}…${tx.from.slice(-4)}`
            : `a ${tx.to.slice(0, 6)}…${tx.to.slice(-4)}`}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div
          className={`font-bold text-sm ${
            isReceive ? 'text-nex-green' : 'text-white'
          }`}
        >
          {isReceive ? '+' : '−'}
          {amount.toLocaleString('en-US', { maximumFractionDigits: 4 })}
        </div>
        <div className="text-xs text-gray-400">{tx.tokenSymbol}</div>
      </div>
    </a>
  );
}
