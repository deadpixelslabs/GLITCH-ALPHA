# DEAD PIXELS PORTAL V3.7.1 — GLITCH ALPHA

V3.7.1 keeps the existing DEAD PIXELS corrupted-terminal UI and the complete V3.5.2 execution stack, then adds **GLITCH ALPHA**, a universal Robinhood Chain token-intelligence module.

## Portal modules

```text
01 ROUTER        holder-gated, non-custodial, 0% protocol fee
02 ALPHA         universal token intelligence
03 STOCK ENGINE  Stock Token registry + fair value
04 ROTATE        Stock-to-Stock
05 PORTFOLIO     builder + rebalancer
06 ORDERS        Wait For Better + client watch orders
07 GLITCH PAD    coming soon
```

## V3.7.1 GLITCH ALPHA
### V3.7.1 ranking corrections

- **ALL TOKENS** uses Blockscout cursor pagination with a **LOAD MORE TOKENS** control instead of being limited to one page.
- Switching to **ALL TOKENS** resets the market-age filter to `ANY AGE`, so an old-token catalog is not accidentally filtered by a previous JUST BORN setting.
- **VOLUME** only includes qualified markets (`>= $10K liquidity`, `>= $25K 24h volume`, `>= 25 tx/24h`) before ranking.
- **GAINERS** also requires minimum liquidity/activity to prevent dust-pool percentage spikes from dominating.
- Market stats are aggregated across unique observed pools per token before scoring.
- GLITCH Alpha Score V2 reduces the old over-reward for tiny fresh pumps and adds market maturity + liquidity/FDV structure.
- The official `$GLITCH` contract is pinned for discovery and receives an **OFFICIAL DEAD PIXELS** badge, but **does not receive a fake score bonus**. Its score remains market-data driven.
- Blockscout token-info + smart-contract V2 endpoints are used for more reliable holder counts and verification state.
- Missing market cap is shown as `--`, not `$0`.


ALPHA is built for memes, Stock Tokens, stablecoins, utility tokens, old tokens and newly appearing ERC-20s on Robinhood Chain.

### Discovery layers

1. **Direct onchain pulse** — scans recent Robinhood Chain logs for ERC-20 `Transfer` events from the zero address. This gives ALPHA an independent fresh-token/mint signal instead of waiting only for a market-data website to index a token.
2. **GeckoTerminal new pools** — discovers freshly created DEX markets.
3. **Blockscout historical index** — provides All Tokens browsing and symbol/name/contract search for older ERC-20s.
4. **DEX Screener** — market/pair enrichment and a second price/statistics source.

A fresh zero-address mint is deliberately labelled a **signal**, not proof that the contract itself was created in that exact block. New-pool creation is tracked separately.

### Radar views

```text
TRENDING
JUST BORN
GAINERS
VOLUME
RISK RADAR
ALL TOKENS
WATCHLIST
```

### Deep token intelligence

Opening a token runs a multi-source scan and can display:

- price, market cap, FDV and liquidity
- 5m / 1h / 6h / 24h price movement
- 24h volume and transaction activity
- market age and DEX/pool
- GLITCH ALPHA SCORE and transparent score components
- buy/sell flow and buyer/seller counts when the data source exposes them
- Blockscout holder count
- Top 10 / Top 20 concentration from the sampled holder list
- creator/deployer address when Blockscout exposes it
- creator share when the creator appears in the sampled top holders
- verified-contract status
- proxy signal
- ABI-based mint / blacklist-like / pause / fee-tax entrypoint signals
- GLITCH risk score and flags
- recent pool trade tape + whale-sized trade filtering when GeckoTerminal exposes trades
- cross-source price consensus between available market sources
- minute OHLCV chart
- direct `LOAD INTO ROUTER`

### Important security wording

ALPHA never claims that a token is guaranteed safe, sellable, profitable or honeypot-free. ABI/source checks are **signals**. A function being present does not prove it is malicious, and a function not being seen does not prove a contract is safe.

## Data refresh model

The browser refreshes:

```text
JUST BORN / onchain pulse  ~8 seconds while ALPHA is open
market overview            ~30 seconds while ALPHA is open
```

GeckoTerminal's public API may itself cache data. V3.7.1 also caches aggregator responses server-side so the ~8 second JUST BORN pulse does not repeatedly hammer a rate-limited market API; direct onchain discovery remains separate from that cache.

This build defaults to the official public Robinhood Chain RPC in `RH_RPC_URL`, so no Alchemy key is required. Public RPC rate limits can still apply under heavy traffic; the rest of ALPHA uses caching and external indexed sources to reduce RPC load.

## Existing execution core preserved

- Robinhood Chain: `4663`
- native gas: ETH
- DEAD PIXELS holder gate: 1+ NFT for executable GLITCH Router quotes
- NFT: `0x27390fe7ae676fbfdb632e61cd4019996b07892c`
- $GLITCH: `0xAeCa11ad61D76f7C2d6b1100d3ca9066FbdB8459`
- 0% DEAD PIXELS protocol fee
- official Uniswap BEST_PRICE baseline
- Nordstern Direct
- LI.FI
- direct ETH/WETH wrap
- wallet-confirmed, non-custodial execution

External pools, bridges, routers or liquidity providers can still charge their own fees/costs. The 0% claim applies to the DEAD PIXELS protocol fee.

## API added

```text
GET /api/alpha?mode=overview
GET /api/alpha?mode=justborn
GET /api/alpha?mode=catalog
GET /api/alpha?mode=search&q=GLITCH
GET /api/alpha?mode=detail&address=0x...
GET /api/alpha?mode=ohlcv&pool=0x...&timeframe=minute
GET /api/alpha?mode=status
```

## Environment variables

Required for the existing official Uniswap execution baseline:

```text
UNISWAP_API_KEY=
```

Optional / recommended:

```text
LIFI_API_KEY=
RH_RPC_URL=https://rpc.mainnet.chain.robinhood.com/
```

For reliable ALPHA production use, replace the public RPC value with your dedicated Robinhood Chain RPC endpoint in Vercel. Never put private keys, seed phrases, or server API keys in `index.html`.

## Simple Vercel deployment

1. Extract this ZIP.
2. Open your existing `portal.deadpixelslabs.com` Vercel project.
3. Replace the project files with the files from this build, or upload/import the build as you normally deploy the Portal.
4. In **Vercel → Project → Settings → Environment Variables**, keep your existing `UNISWAP_API_KEY` and `LIFI_API_KEY` if used.
5. Add/update `RH_RPC_URL` with your production Robinhood Chain RPC. Public RPC works as a fallback for testing.
6. Deploy.
7. Open `/api/health` and confirm the app reports `DEAD PIXELS PORTAL V3.7.1`.
8. Open Portal → **02 ALPHA**.
9. Test `JUST BORN`, search `$GLITCH`, and open a token detail page.
10. Connect a DEAD PIXELS holder wallet and test `LOAD INTO ROUTER` with a tiny amount before announcing production.

## Rollout note

The V3.6 Supabase analytics implementation was not present inside the V3.5.2 source ZIP used as this build's base, so this package does not fabricate or silently replace that separate V3.6 analytics code. GLITCH ALPHA is added cleanly on top of the supplied V3.5.2 codebase.
