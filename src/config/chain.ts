export const WORLDCHAIN = {
  id: 480,
  name: 'World Chain',
  rpc: 'https://worldchain-mainnet.g.alchemy.com/public',
  explorer: 'https://worldscan.org',
} as const;

export const APP_CONFIG = {
  appId:
    process.env.NEXT_PUBLIC_APP_ID ||
    'app_20c80a62293853c3f98455b3017d5e6c',
};

// === FEES DEL SWAP ===
// Wallet de NexChain que recibe el fee de cada swap
export const FEE_RECEIVER = '0x3de83b386c983426547b3b42e50b810ab9a25deb';

// Fee base: 0.3% (30 basis points)
export const SWAP_FEE_BPS = 30;

// Fee con descuento (si tenes NXCH): 0.1% (10 basis points)
export const SWAP_FEE_DISCOUNTED_BPS = 10;

// === UNISWAP V3 EN WORLD CHAIN ===
// Direcciones oficiales: https://docs.uniswap.org/contracts/v3/reference/deployments/WorldChain-deployments
export const UNISWAP_V3 = {
  FACTORY: '0x7a5028BDa40e7B173C278C5342087826455ea25a',
  QUOTER_V2: '0x10158D43e6cc414deE1Bd1eB0EfC6a5cBCfF244c',
  SWAP_ROUTER_02: '0x091AD9e2e6e5eD44c1c66dB50e49A601F9f36cF6',
  UNIVERSAL_ROUTER: '0x8ac7bee993bb44dab564ea4bc9ea67bf9eb5e743',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  WETH: '0x4200000000000000000000000000000000000006',
} as const;

// Fee tiers de Uniswap V3 que probamos en orden
export const FEE_TIERS = [500, 3000, 10000] as const; // 0.05%, 0.3%, 1%
