# color 💄

**Lip balm in every shade.** A small, fast, dependency-free storefront for a
fictional tinted lip-balm brand called *color*.

![shades](https://img.shields.io/badge/shades-12-ff5d8f) ![vegan](https://img.shields.io/badge/vegan-100%25-34d399) ![build](https://img.shields.io/badge/build-none-c084fc)

## What's inside

- **12 lip balm shades**, each named after its color (Rosewood, Coral Crush, Lavender, Cherry, Mint, Sky, Cocoa, Midnight…).
- **Color-family filtering** — tap Pink / Red / Orange / Yellow / Green / Blue / Purple / Neutral to narrow the grid.
- **A working cart** — add/remove, change quantities, free-shipping progress bar. Cart persists in `localStorage`.
- **Real checkout via Stripe** — a Vercel serverless function creates a [Stripe Checkout](https://stripe.com/docs/payments/checkout) session and redirects to Stripe's hosted, PCI-compliant payment page (card, Apple/Google Pay, shipping, email). Prices are validated server-side.
- **Animated, responsive design** — floating balm hero, rainbow type, marquee, hover effects, mobile-friendly drawer.
- **Storefront is pure HTML/CSS/vanilla JS.** The only dependency is `stripe` for the checkout function.

## Stripe setup

1. Create a Stripe account and grab your secret key from
   [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
   (use the **test** key, `sk_test_…`, while developing).
2. Add it as an environment variable named `STRIPE_SECRET_KEY`:
   - **Locally:** copy `.env.example` to `.env` and paste your key in.
   - **On Vercel:** Project → Settings → Environment Variables → add `STRIPE_SECRET_KEY`.
3. Test payments use card `4242 4242 4242 4242`, any future expiry, any CVC/ZIP.

## Run locally

Static front end only (checkout button won't work without the function):

```bash
python3 -m http.server 8000   # visit http://localhost:8000
```

Full stack incl. the Stripe function:

```bash
npm install
npx vercel dev                # serves the site + /api/checkout
```

## Deploy

```bash
npx vercel --prod
```

Make sure `STRIPE_SECRET_KEY` is set in the Vercel project. Vercel auto-detects
the `api/` folder as serverless functions — no extra config needed.

## x402 bot paywall

Humans browse free. AI crawlers / scrapers (GPTBot, ClaudeBot, CCBot, PerplexityBot,
`curl`, `python-requests`, HeadlessChrome, …) get **HTTP 402** with
[x402](https://x402.org) payment requirements ($0.001 USDC on Base per request);
if they pay, they get the page with a `PAYMENT-RESPONSE` settlement header.

- `middleware.js` — Vercel Routing Middleware entry (Node runtime).
- `x402/bot-paywall.js` — config, `BOT_UA_PATTERNS`, free-path rules, x402 server (`@x402/core` + `@x402/evm`).
- Search engines / link unfurlers / uptime monitors (Googlebot, Bingbot, Applebot, Slackbot, Vercel, …) are never charged.
- Never paywalled: `/api/*` (Stripe checkout + webhook), `/robots.txt`, `/sitemap*.xml`, `/favicon*`, `/llms.txt`, `/.well-known/*`, static assets.
- Fails open: any error or facilitator outage serves the page normally.

Env vars (see `.env.example`): `X402_ENABLED` (set `false` to disable), `X402_PAY_TO`, `X402_PRICE`,
`X402_NETWORK` (default `eip155:8453`), `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` (Coinbase CDP facilitator —
**required for Base mainnet**), or `X402_FACILITATOR_URL` (default `https://x402.org/facilitator`, testnet only).
Without CDP keys on mainnet the paywall can't initialize and simply fails open (bots served free).

## Project structure

```
index.html       # storefront markup (header, hero, shop, cart drawer)
success.html     # post-payment thank-you page
styles.css       # design tokens + all styling
app.js           # product catalog, filtering, cart, Stripe redirect
api/checkout.js  # serverless fn: creates a Stripe Checkout session
middleware.js    # x402 bot paywall (Vercel Routing Middleware)
x402/            # bot paywall logic
package.json     # stripe dependency + dev/deploy scripts
vercel.json      # deploy config
.env.example     # template for STRIPE_SECRET_KEY
```

## How checkout works

```
browser cart  ──POST /api/checkout──▶  serverless fn
                                        ├─ looks up real prices (CATALOG)
                                        ├─ creates Stripe Checkout Session
                                        └─ returns session.url
browser  ◀──redirect──  Stripe-hosted payment page  ──▶  success.html
```

---

*Made with love & shea butter. All shades reserved.*
