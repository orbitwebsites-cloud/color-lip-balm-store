// Stripe webhook → CJ Dropshipping auto-fulfillment
// Vercel calls this at POST /api/webhook when Stripe fires an event.
// Stripe signature verification ensures ONLY Stripe can trigger orders.

const Stripe = require("stripe");

// Maps your product IDs (from app.js) to CJ Dropshipping product/variant IDs.
// Fill these in from your CJ Dropshipping product listings.
// CJ product page URL looks like: https://cjdropshipping.com/product/xxx.html
// The vid (variant ID) is found under each size/color option on the CJ listing.
const CJ_PRODUCTS = {
  rosewood:      { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  "coral-crush": { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  honey:         { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  lavender:      { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  cherry:        { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  mint:          { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  sky:           { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  cocoa:         { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  bubblegum:     { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  plum:          { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  tangerine:     { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
  midnight:      { pid: "TODO_CJ_PRODUCT_ID", vid: "TODO_CJ_VARIANT_ID" },
};

// ── CJ Dropshipping helpers ───────────────────────────────────────────────────

// CJ API key auth — uses the key from your CJ account API settings.
// Set CJ_API_KEY in Vercel environment variables. Never hardcode it here.
async function getCJToken() {
  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) throw new Error("CJ_API_KEY environment variable is not set");

  const res = await fetch("https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  const data = await res.json();
  if (!data.result || !data.data?.accessToken) {
    throw new Error(`CJ auth failed: ${data.message || JSON.stringify(data)}`);
  }
  return data.data.accessToken;
}

async function placeCJOrder(token, { customerName, address, items }) {
  // Build the order payload CJ expects.
  // Docs: https://developers.cjdropshipping.com/api-doc.html#/Order%20Management/createOrder
  const orderPayload = {
    orderNumber: `COLOR-${Date.now()}`,
    shippingZip: address.postal_code,
    shippingCountryCode: address.country,
    shippingCountry: address.country,
    shippingProvince: address.state,
    shippingCity: address.city,
    shippingAddress: address.line1,
    shippingAddress2: address.line2 || "",
    shippingCustomerName: customerName,
    shippingPhone: "", // Stripe doesn't collect phone by default; add phone_number_collection in checkout if needed
    products: items.map((item) => ({
      vid: item.vid,
      quantity: item.quantity,
    })),
  };

  const res = await fetch("https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CJ-Access-Token": token,
    },
    body: JSON.stringify(orderPayload),
  });

  const data = await res.json();
  if (!data.result) {
    throw new Error(`CJ order failed: ${data.message || JSON.stringify(data)}`);
  }
  return data.data; // { orderId, orderNum, ... }
}

// ── Webhook handler ───────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).end("Webhook secret not configured");
  }

  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // req.body is a raw Buffer here (bodyParser disabled in vercel.json for this route)
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).end(`Webhook Error: ${err.message}`);
  }

  // Only act on completed checkouts
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true, skipped: event.type });
  }

  const session = event.data.object;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Retrieve the full session with line items and shipping details
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items"],
    });

    const shipping = fullSession.shipping_details;
    const customerName = shipping?.name || fullSession.customer_details?.name || "Customer";
    const address = shipping?.address;

    if (!address) {
      console.error("No shipping address on session:", session.id);
      return res.status(200).json({ received: true, error: "No shipping address" });
    }

    // Map Stripe line items back to CJ product IDs using the session metadata.
    // Because Stripe line items only have display names, we embed the product IDs
    // in the session metadata via checkout.js (see note below — update checkout.js too).
    // Fallback: parse from the item name if metadata isn't set yet.
    const rawItems = fullSession.metadata?.cart
      ? JSON.parse(fullSession.metadata.cart)
      : null;

    if (!rawItems) {
      console.error("No cart metadata on session:", session.id, "— update api/checkout.js to pass metadata");
      return res.status(200).json({ received: true, error: "Missing cart metadata — see README" });
    }

    const cjItems = Object.entries(rawItems)
      .map(([productId, quantity]) => {
        const cj = CJ_PRODUCTS[productId];
        if (!cj || cj.vid === "TODO_CJ_VARIANT_ID") {
          console.warn(`No CJ mapping for product: ${productId} — skipping`);
          return null;
        }
        return { vid: cj.vid, quantity: parseInt(quantity, 10) };
      })
      .filter(Boolean);

    if (cjItems.length === 0) {
      console.error("No CJ-mappable items in order. Fill in CJ_PRODUCTS in api/webhook.js");
      return res.status(200).json({ received: true, error: "No CJ product IDs mapped yet" });
    }

    const token = await getCJToken();
    const cjOrder = await placeCJOrder(token, {
      customerName,
      address,
      items: cjItems,
    });

    console.log("✅ CJ order placed:", cjOrder.orderId, "for Stripe session:", session.id);
    return res.status(200).json({ received: true, cjOrderId: cjOrder.orderId });

  } catch (err) {
    console.error("Auto-fulfillment error:", err.message);
    // Still return 200 so Stripe doesn't retry — log and investigate manually
    return res.status(200).json({ received: true, error: err.message });
  }
};

// Disable body parsing so Stripe signature verification gets the raw bytes
module.exports.config = { api: { bodyParser: false } };
