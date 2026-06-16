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

## Project structure

```
index.html       # storefront markup (header, hero, shop, cart drawer)
success.html     # post-payment thank-you page
styles.css       # design tokens + all styling
app.js           # product catalog, filtering, cart, Stripe redirect
api/checkout.js  # serverless fn: creates a Stripe Checkout session
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
