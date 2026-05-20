'use client';

import { useQuery } from '@tanstack/react-query';

export type Transaction = {
  hash: string;
  type: 'send' | 'receive' | 'swap' | 'contract';
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;
  from: string;
  to: string;
  timestamp: number;
  blockNumber: number;
};

export function useTransactionHistory(walletAddress: string | null) {
  return useQuery({
    queryKey: ['history', walletAddress],
    queryFn: async (): Promise<Transaction[]> => {
      if (!walletAddress) return [];
      try {
        // Worldscan API es compatible con Etherscan
        const url = `https://api.worldscan.org/api?module=account&action=tokentx&address=${walletAddress}&page=1&offset=50&sort=desc`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        const txs = data?.result || [];
        if (!Array.isArray(txs)) return [];

        const seen = new Set<string>();
        const result: Transaction[] = [];

        for (const tx of txs) {
          if (seen.has(tx.hash)) continue;
          seen.add(tx.hash);

          const isReceive = tx.to?.toLowerCase() === walletAddress.toLowerCase();
          const decimals = parseInt(tx.tokenDecimal || '18');
          const rawValue = BigInt(tx.value || '0');
          const divisor = BigInt(10) ** BigInt(decimals);
          const whole = rawValue / divisor;
          const frac = rawValue % divisor;
          const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4);
          const amount = `${whole.toString()}.${fracStr}`;

          result.push({
            hash: tx.hash,
            type: isReceive ? 'receive' : 'send',
            tokenSymbol: tx.tokenSymbol || '?',
            tokenAddress: tx.contractAddress || '',
            amount,
            from: tx.from,
            to: tx.to,
            timestamp: parseInt(tx.timeStamp) * 1000,
            blockNumber: parseInt(tx.blockNumber),
          });
        }
        return result.sort((a, b) => b.timestamp - a.timestamp);
      } catch (err) {
        console.error('History error:', err);
        return [];
      }
    },
    enabled: !!walletAddress,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
