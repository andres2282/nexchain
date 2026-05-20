# NexChain — Wallet simple para World Chain

Mini app para World App. 3 tabs limpios:

- **Wallet** — saldo total, recibir/enviar/swap, todos tus tokens
- **Buscar** — encontrá cualquier token en World Chain
- **Historial** — tus transacciones recientes

## Stack

- Next.js 14 + React 18
- MiniKit v1.9.6
- viem (lectura on-chain)
- React Query
- Tailwind CSS
- Alchemy RPC (descubrimiento de tokens)
- DexScreener API (precios + búsqueda)
- Worldscan API (historial)

## Deploy en Vercel

Environment Variables:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_APP_ID` | tu App ID de developer.worldcoin.org |

## Developer Portal de World

- **App URL**: la URL de Vercel
- **Contract Entrypoints**: solo necesitás Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`). El swap usa deeplink al Swap oficial de World, así que no necesitás whitelist de routers.
