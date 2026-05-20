export type SwapToken = {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
};

// === IMPORTANTE: Address de NXCH ===
// NXCH se usa SOLO para detectar descuento en fees (0.1% en vez de 0.3%).
// NO aparece como token swappeable hasta que tenga mas liquidez en Uniswap.
// Cuando agregues 500+ USD al pool, mover NXCH_METADATA al array SWAP_TOKENS.
export const NXCH_ADDRESS =
  '0x7c72F1327590f6e42d71c9b9512e0B320fBcfC1D' as const;

export const NXCH_METADATA: SwapToken = {
  address: NXCH_ADDRESS,
  symbol: 'NXCH',
  name: 'NexChain Token',
  decimals: 18,
  logo: '',
};

// Tokens disponibles para swap (con liquidez confirmada o por confirmar antes del launch)
// NXCH se agrega liquidez antes del lanzamiento publico.
export const SWAP_TOKENS: SwapToken[] = [
  {
    address: '0x2cFc85d8E48F8EAB294be644d9E25C3030863003',
    symbol: 'WLD',
    name: 'Worldcoin',
    decimals: 18,
    logo: 'https://cryptologos.cc/logos/worldcoin-org-wld-logo.png',
  },
  {
    address: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  },
  {
    address: '0x102d758f688a4C1C5a80b116bD945d4455460282',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
  },
  {
    address: NXCH_ADDRESS,
    symbol: 'NXCH',
    name: 'NexChain Token',
    decimals: 18,
    logo: 'https://i.ibb.co/4Zxnzjjq/3-C8-E7-D07-87-DE-4-F10-8952-F14-DCA7-E5-B45.jpg',
  },
];

// Tokens visibles en la lista del wallet
// SIEMPRE se muestran a todos los usuarios (curados por Andres)
export const VISIBLE_TOKENS: SwapToken[] = SWAP_TOKENS;

export function findToken(address: string): SwapToken | undefined {
  return VISIBLE_TOKENS.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
}

export function isKnownToken(address: string): boolean {
  return VISIBLE_TOKENS.some(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
}
