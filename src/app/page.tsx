'use client';

import { useEffect, useState } from 'react';
import { Loader2, Wallet, LogOut } from 'lucide-react';
import { Header } from '@/components/Header';
import { BottomNav, type Tab } from '@/components/BottomNav';
import { WalletView } from '@/components/WalletView';
import { SearchView } from '@/components/SearchView';
import { HistoryView } from '@/components/HistoryView';
import { HexLogo } from '@/components/HexLogo';
import {
  signInWithWallet,
  getStoredSession,
  clearSession,
  waitForMiniKit,
  type AuthSession,
} from '@/lib/auth';

export default function Page() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [tab, setTab] = useState<Tab>('wallet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = getStoredSession();
      if (stored) setSession(stored);
      await waitForMiniKit(2500);
      setChecking(false);
    })();
  }, []);

  const handleConnect = async () => {
    setError(null);
    setLoading(true);
    try {
      const s = await signInWithWallet();
      if (s) setSession(s);
    } catch (err: any) {
      setError(err?.message || 'No se pudo conectar');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setTab('wallet');
  };

  // Loading inicial
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-nex-green animate-spin" />
      </div>
    );
  }

  // Login
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 animate-fade-in">
        <div className="flex flex-col items-center text-center max-w-sm w-full">
          <HexLogo size={92} />
          <h1 className="font-cyber text-4xl font-black mt-6 tracking-tight">
            <span className="text-white">NEX</span>
            <span className="bg-gradient-to-r from-nex-green to-nex-cyan bg-clip-text text-transparent">
              CHAIN
            </span>
          </h1>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed">
            Wallet simple para World Chain
            <br />
            Tus tokens, en un solo lugar
          </p>

          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full mt-10 py-4 rounded-2xl bg-gradient-to-r from-nex-green to-nex-cyan text-black font-cyber font-black text-base shadow-glow-green active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                CONECTAR WALLET
              </>
            )}
          </button>

          <p className="text-[11px] text-gray-500 mt-3">
            Asegurate de abrir NexChain desde World App
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 leading-relaxed text-left w-full">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // App
  return (
    <div className="min-h-screen pb-20">
      <Header address={session.address} />

      <main className="max-w-md mx-auto">
        {tab === 'wallet' && <WalletView walletAddress={session.address} />}
        {tab === 'search' && <SearchView walletAddress={session.address} />}
        {tab === 'history' && (
          <HistoryView walletAddress={session.address} />
        )}

        <div className="px-4">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl bg-nex-panel border border-white/5 text-xs text-gray-400 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
