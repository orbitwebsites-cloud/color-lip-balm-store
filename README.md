# color 💄

**Lip balm in every shade.** A small, fast, dependency-free storefront for a
fictional tinted lip-balm brand called *color*.

![shades](https://img.shields.io/badge/shades-12-ff5d8f) ![vegan](https://img.shields.io/badge/vegan-100%25-34d399) ![build](https://img.shields.io/badge/build-none-c084fc)

## What's inside

- **12 lip balm shades**, each named after its color (Rosewood, Coral Crush, Lavender, Cherry, Mint, Sky, Cocoa, Midnight…).
- **Color-family filtering** — tap Pink / Red / Orange / Yellow / Green / Blue / Purple / Neutral to narrow the grid.
- **A working cart** — add/remove, change quantities, free-shipping progress bar, and a demo checkout. Cart persists in `localStorage`.
- **Animated, responsive design** — floating balm hero, rainbow type, marquee, hover effects, mobile-friendly drawer.
- **Zero dependencies, no build step.** Pure HTML, CSS, and vanilla JS.

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy

This is a static site, so it deploys anywhere. For Vercel:

```bash
npm i -g vercel
vercel --prod
```

`vercel.json` is already included (clean URLs, no trailing slash).

## Project structure

```
index.html   # markup: header, hero, shop, about, footer, cart drawer
styles.css   # design tokens + all styling
app.js       # product catalog, filtering, cart logic
vercel.json  # static deploy config
```

---

*Made with love & shea butter. All shades reserved.*
