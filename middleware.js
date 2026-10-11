// Vercel Routing Middleware — x402 bot paywall (see x402/bot-paywall.js).
// Humans: untouched. AI crawlers/scrapers: HTTP 402 + x402 payment requirements.
// /api/* (Stripe checkout + webhook), robots/sitemaps/static assets are never touched.

import { next } from "@vercel/functions";
import { handleBotPaywall } from "./x402/bot-paywall.js";

export const config = {
  runtime: "nodejs",
  // Skip API routes, well-known files and static assets before the function even runs.
  matcher: [
    "/((?!api/|_next/static|_vercel|\\.well-known/|robots\\.txt|llms\\.txt|sitemap|favicon).*)",
  ],
};

export default async function middleware(request) {
  const result = await handleBotPaywall(request);
  if (result.action === "respond") return result.response;
  if (result.action === "serve-paid") return next({ headers: result.headers });
  return undefined; // continue to the static page / function as normal
}
