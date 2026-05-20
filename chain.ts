'use client';

import { ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MiniKit } from '@worldcoin/minikit-js';
import { APP_CONFIG } from '@/config/chain';

function MiniKitInit({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        MiniKit.install(APP_CONFIG.appId);
      } catch (err) {
        console.warn('MiniKit install:', err);
      }
    }
  }, []);
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <MiniKitInit>{children}</MiniKitInit>
    </QueryClientProvider>
  );
}
