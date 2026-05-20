'use client';

// Wallet Auth basado EXACTO en docs.world.org/mini-apps/commands/wallet-auth
// MiniKit v1.9.6: MiniKit.commandsAsync.walletAuth(...)
// Respuesta: { commandPayload, finalPayload }
// finalPayload.address = wallet address del usuario

import { MiniKit } from '@worldcoin/minikit-js';

export type AuthSession = { address: string };

export async function waitForMiniKit(timeoutMs = 3000): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (MiniKit.isInstalled()) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  try {
    return MiniKit.isInstalled();
  } catch {
    return false;
  }
}

export async function signInWithWallet(): Promise<AuthSession | null> {
  if (!MiniKit.isInstalled()) {
    throw new Error('Abrí esta app desde World App');
  }

  const nonceRes = await fetch('/api/nonce');
  if (!nonceRes.ok) throw new Error('No se pudo obtener el nonce');
  const { nonce } = await nonceRes.json();

  const result = await (MiniKit as any).commandsAsync.walletAuth({
    nonce,
    requestId: '0',
    expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
    statement: 'Acceder a NexChain',
  });

  const finalPayload = result?.finalPayload;
  if (!finalPayload || finalPayload.status === 'error') {
    throw new Error('Login cancelado');
  }

  const address: string =
    finalPayload.address || (MiniKit as any).walletAddress || '';

  if (!address) throw new Error('No se obtuvo la wallet');

  // Verificar firma en backend (no bloquear si falla)
  try {
    await fetch('/api/complete-siwe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: finalPayload, nonce }),
    });
  } catch (err) {
    console.warn('SIWE verify failed:', err);
  }

  const session: AuthSession = { address };
  if (typeof window !== 'undefined') {
    localStorage.setItem('nexchain_session', JSON.stringify(session));
  }
  return session;
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('nexchain_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('nexchain_session');
  }
}
