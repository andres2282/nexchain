import { createPublicClient, http, defineChain } from 'viem';
import { WORLDCHAIN } from '@/config/chain';

export const worldchain = defineChain({
  id: WORLDCHAIN.id,
  name: WORLDCHAIN.name,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [WORLDCHAIN.rpc] } },
  blockExplorers: { default: { name: 'Worldscan', url: WORLDCHAIN.explorer } },
});

export const publicClient = createPublicClient({
  chain: worldchain,
  transport: http(WORLDCHAIN.rpc),
});
