// x402 bot paywall — shared logic for the Vercel Routing Middleware (../middleware.js).
//
// Humans browse free. AI crawlers / scrapers (matched by User-Agent) get
// HTTP 402 + x402 payment requirements; if they pay, they get the page.
// Everything fails OPEN: any error or facilitator outage serves the page.

import { x402ResourceServer, x402HTTPResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";

// ── Config (all env-overridable) ─────────────────────────────────────────────

const env = (k) => (typeof process !== "undefined" && process.env ? process.env[k] : undefined);

export const X402_CONFIG = {
  enabled: (env("X402_ENABLED") || "true").toLowerCase() !== "false",
  payTo: env("X402_PAY_TO") || "0x0ba3b8796ce61ef8Cbd11A7F33Be31F1Fd4A03B3",
  price: env("X402_PRICE") || "$0.001",
  network: env("X402_NETWORK") || "eip155:8453", // Base mainnet, USDC
  facilitatorUrl: env("X402_FACILITATOR_URL") || "https://x402.org/facilitator",
  cdpApiKeyId: env("CDP_API_KEY_ID"),
  cdpApiKeySecret: env("CDP_API_KEY_SECRET"),
  description: "Paid access for automated agents",
  mimeType: "text/html",
};

// ── Bot detection (case-insensitive User-Agent substrings) ───────────────────

export const BOT_UA_PATTERNS = {
  // Checked FIRST — search engines, link unfurlers, platform & uptime bots stay free.
  neverCharge: [
    "googlebot", "bingbot", "duckduckbot", "slurp", "twitterbot", "facebookexternalhit",
    "linkedinbot", "slackbot", "discordbot", "whatsapp", "telegrambot", "vercel",
    // uptime monitors
    "uptimerobot", "pingdom", "statuscake", "betteruptime", "better uptime", "betterstack",
    "site24x7", "datadog", "checkly", "freshping", "uptime-kuma", "uptimekuma",
    "hetrixtools", "updown.io", "nodeping", "monitis", "cron-job.org",
  ],
  // "Applebot" is free, but "Applebot-Extended" (AI training) is charged.
  neverChargeRegex: [/applebot(?!-extended)/i],
  charge: [
    "gptbot", "chatgpt-user", "oai-searchbot", "claudebot", "claude-user", "claude-searchbot",
    "anthropic-ai", "ccbot", "perplexitybot", "perplexity-user", "bytespider", "amazonbot",
    "applebot-extended", "google-extended", "meta-externalagent", "meta-externalfetcher",
    "facebookbot", "diffbot", "cohere-ai", "cohere-training-data-crawler", "youbot", "ai2bot",
    "ai2bot-dolma", "timpibot", "imagesiftbot", "omgili", "petalbot", "scrapy",
    "python-requests", "aiohttp", "go-http-client", "curl", "wget", "headlesschrome", "phantomjs",
  ],
};

export function isChargeableBot(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return false;
  if (BOT_UA_PATTERNS.neverCharge.some((p) => ua.includes(p))) return false;
  if (BOT_UA_PATTERNS.neverChargeRegex.some((re) => re.test(ua))) return false;
  return BOT_UA_PATTERNS.charge.some((p) => ua.includes(p));
}

// ── Always-free paths ────────────────────────────────────────────────────────

const STATIC_EXT =
  /\.(css|js|mjs|cjs|map|json|png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|ogg|pdf|txt|xml|webmanifest)$/i;

export function isFreePath(pathname) {
  const p = pathname || "/";
  if (p.startsWith("/api/") || p === "/api") return true; // Stripe checkout + webhook must never break
  if (p === "/robots.txt" || p === "/llms.txt") return true;
  if (/^\/sitemap[^/]*\.xml$/i.test(p)) return true;
  if (p.startsWith("/favicon")) return true;
  if (p.startsWith("/.well-known/")) return true;
  if (/^\/(_next\/static|_vercel|static|assets|images|img|fonts|css|js)\//i.test(p)) return true;
  if (STATIC_EXT.test(p)) return true;
  return false;
}

// ── x402 server (lazy, cached per instance) ──────────────────────────────────

let httpServerPromise = null;
let initFailedAt = 0;
const INIT_RETRY_MS = 60_000;

async function createFacilitatorClient() {
  if (X402_CONFIG.cdpApiKeyId && X402_CONFIG.cdpApiKeySecret) {
    // Coinbase CDP facilitator (authenticated) via the official helper.
    const { createFacilitatorConfig } = await import("@coinbase/x402");
    return new HTTPFacilitatorClient({
      ...createFacilitatorConfig(X402_CONFIG.cdpApiKeyId, X402_CONFIG.cdpApiKeySecret),
      timeoutMs: 15_000,
    });
  }
  return new HTTPFacilitatorClient({ url: X402_CONFIG.facilitatorUrl, timeoutMs: 15_000 });
}

async function buildHttpServer() {
  const facilitatorClient = await createFacilitatorClient();
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    X402_CONFIG.network,
    new ExactEvmScheme(),
  );
  // Single route config => applies to every request we hand it (we pre-filter bots/paths).
  const httpServer = new x402HTTPResourceServer(resourceServer, {
    accepts: [
      {
        scheme: "exact",
        price: X402_CONFIG.price,
        network: X402_CONFIG.network,
        payTo: X402_CONFIG.payTo,
      },
    ],
    description: X402_CONFIG.description,
    mimeType: X402_CONFIG.mimeType,
  });
  await httpServer.initialize(); // fetches facilitator /supported + validates route config
  return httpServer;
}

async function getHttpServer() {
  if (!httpServerPromise) {
    if (initFailedAt && Date.now() - initFailedAt < INIT_RETRY_MS) {
      throw new Error("x402 init recently failed; skipping (fail open)");
    }
    httpServerPromise = buildHttpServer().catch((err) => {
      httpServerPromise = null;
      initFailedAt = Date.now();
      throw err;
    });
  }
  return httpServerPromise;
}

// ── Request handling ─────────────────────────────────────────────────────────

class FetchRequestAdapter {
  constructor(request, url) {
    this.request = request;
    this.url = url;
  }
  getHeader(name) {
    return this.request.headers.get(name) || undefined;
  }
  getMethod() {
    return this.request.method;
  }
  getPath() {
    return this.url.pathname;
  }
  getUrl() {
    return this.request.url;
  }
  // Bots always get the machine-readable JSON challenge (never the HTML wallet paywall,
  // which e.g. HeadlessChrome would otherwise trigger).
  getAcceptHeader() {
    return "application/json";
  }
  getUserAgent() {
    return this.request.headers.get("user-agent") || "";
  }
  getQueryParams() {
    const out = {};
    this.url.searchParams.forEach((v, k) => {
      const cur = out[k];
      out[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v];
    });
    return out;
  }
  getQueryParam(name) {
    const all = this.url.searchParams.getAll(name);
    return all.length === 0 ? undefined : all.length === 1 ? all[0] : all;
  }
}

function toResponse(instr) {
  const headers = new Headers(instr.headers || {});
  let body = instr.body;
  // v2 puts requirements in the PAYMENT-REQUIRED header; also mirror them in the JSON body.
  if ((body === undefined || (body && typeof body === "object" && !Object.keys(body).length))) {
    const hdr = headers.get("PAYMENT-REQUIRED");
    if (hdr) {
      try {
        body = decodePaymentRequiredHeader(hdr);
      } catch {
        /* keep original body */
      }
    }
  }
  if (instr.isHtml) {
    headers.set("Content-Type", "text/html");
    return new Response(body, { status: instr.status, headers });
  }
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body ?? {}), { status: instr.status, headers });
}

/**
 * Decide what to do with a request.
 * @returns {Promise<{action: "pass"} | {action: "respond", response: Response} | {action: "serve-paid", headers: Record<string,string>}>}
 */
export async function handleBotPaywall(request) {
  try {
    if (!X402_CONFIG.enabled) return { action: "pass" };
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") return { action: "pass" };

    const url = new URL(request.url);
    if (isFreePath(url.pathname)) return { action: "pass" };
    if (!isChargeableBot(request.headers.get("user-agent"))) return { action: "pass" };

    const httpServer = await getHttpServer();
    const adapter = new FetchRequestAdapter(request, url);
    let decodedPath = url.pathname;
    try {
      decodedPath = decodeURIComponent(url.pathname);
    } catch {
      /* ignore */
    }
    const context = {
      adapter,
      path: url.pathname,
      decodedPath,
      method,
      paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("x-payment"),
    };

    const result = await httpServer.processHTTPRequest(context);
    switch (result.type) {
      case "no-payment-required":
        return { action: "pass" };
      case "payment-error":
        return { action: "respond", response: toResponse(result.response) };
      case "payment-verified": {
        // Static pages can't fail after this point, so settle now, then serve the page
        // with the PAYMENT-RESPONSE settlement header attached.
        const settle = await httpServer.processSettlement(
          result.paymentPayload,
          result.paymentRequirements,
          result.declaredExtensions,
          { request: context },
          undefined,
          result.beforeHandlerSettlement,
        );
        if (!settle.success) return { action: "respond", response: toResponse(settle.response) };
        return { action: "serve-paid", headers: { ...settle.headers, "Cache-Control": "private, no-store" } };
      }
      default:
        return { action: "pass" };
    }
  } catch (err) {
    // FAIL OPEN — never break the site.
    console.warn("[x402] bot paywall error, serving page:", err && err.message ? err.message : err);
    return { action: "pass" };
  }
}
