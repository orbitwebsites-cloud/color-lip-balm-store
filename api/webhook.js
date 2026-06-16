// Stripe webhook → CJ Dropshipping auto-fulfillment
// POST /api/webhook — called by Stripe on checkout.session.completed
// Stripe signature verification ensures ONLY Stripe can trigger orders.

const Stripe = require("stripe");

// Maps your store's product IDs to CJ product IDs (pid).
// To add more products: find the CJ product page, grab the ID from the URL.
const CJ_CATALOG = {
  "women-dress": { pid: "1705465925572497408", name: "Loose Linen Midi Dress" },
  "men-cargo":   { pid: "1670981011842273280", name: "Streetwear Cargo Pants" },
  "ems-tool":    { pid: "1914884885643104257", name: "EMS Facial Beauty Tool" },
};

// ── CJ API helpers ────────────────────────────────────────────────────────────

async function getCJToken() {
  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) throw new Error("CJ_API_KEY is not set");
  const res = await fetch("https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  const data = await res.json();
  if (!data.result || !data.data?.accessToken) {
    throw new Error(`CJ auth failed: ${data.message}`);
  }
  return data.data.accessToken;
}

// Fetches all variants for a CJ product and returns the vid matching color+size.
async function getCJVariantId(token, pid, color, size) {
  const res = await fetch(
    `https://developers.cjdropshipping.com/api2.0/v1/shopping/product/queryByPid?pid=${pid}`,
    { headers: { "CJ-Access-Token": token } }
  );
  const data = await res.json();
  if (!data.result || !data.data?.variants) {
    throw new Error(`CJ product lookup failed for pid ${pid}: ${data.message}`);
  }

  const variants = data.data.variants;

  // Find the variant whose properties match the selected color and size.
  // If no size (beauty/one-size products), match by color only.
  const match = variants.find((v) => {
    const props = v.variantProperty || [];
    const colorMatch = !color || props.some(
      (p) => p.propertyNameEn?.toLowerCase() === "color" &&
             p.propertyValueEn?.toLowerCase() === color.toLowerCase()
    );
    const sizeMatch = !size || size === "_" || props.some(
      (p) => p.propertyNameEn?.toLowerCase() === "size" &&
             p.propertyValueEn?.toLowerCase() === size.toLowerCase()
    );
    return colorMatch && sizeMatch;
  });

  // Fall back to first available variant if exact match not found
  if (!match) {
    console.warn(`No exact variant match for pid=${pid} color=${color} size=${size} — using first variant`);
    return variants[0]?.vid;
  }
  return match.vid;
}

async function placeCJOrder(token, { orderNumber, customerName, address, items }) {
  const payload = {
    orderNumber,
    shippingZip: address.postal_code,
    shippingCountryCode: address.country,
    shippingCountry: address.country,
    shippingProvince: address.state,
    shippingCity: address.city,
    shippingAddress: address.line1,
    shippingAddress2: address.line2 || "",
    shippingCustomerName: customerName,
    shippingPhone: "",
    products: items.map((item) => ({ vid: item.vid, quantity: item.quantity })),
  };

  const res = await fetch("https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CJ-Access-Token": token },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.result) throw new Error(`CJ order failed: ${data.message}`);
  return data.data;
}

// ── Webhook handler ───────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).end("STRIPE_WEBHOOK_SECRET not set");

  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).end(`Webhook Error: ${err.message}`);
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true, skipped: event.type });
  }

  const session = event.data.object;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ["line_items"] });

    const shipping = full.shipping_details;
    const customerName = shipping?.name || full.customer_details?.name || "Customer";
    const address = shipping?.address;
    if (!address) {
      console.error("No shipping address on session:", session.id);
      return res.status(200).json({ received: true, error: "No shipping address" });
    }

    const rawCart = full.metadata?.cart ? JSON.parse(full.metadata.cart) : null;
    if (!rawCart) {
      console.error("No cart metadata on session:", session.id);
      return res.status(200).json({ received: true, error: "Missing cart metadata" });
    }

    const token = await getCJToken();

    // Resolve each cart item to a CJ variant ID
    const cjItems = [];
    for (const [cartKey, qty] of Object.entries(rawCart)) {
      const [productId, color, size] = cartKey.split("::");
      const cjProduct = CJ_CATALOG[productId];
      if (!cjProduct) {
        console.warn(`No CJ mapping for product: ${productId}`);
        continue;
      }
      const vid = await getCJVariantId(token, cjProduct.pid, color, size);
      if (!vid) { console.warn(`No variant found for ${productId} ${color} ${size}`); continue; }
      cjItems.push({ vid, quantity: parseInt(qty, 10) });
    }

    if (cjItems.length === 0) {
      return res.status(200).json({ received: true, error: "No CJ items resolved" });
    }

    const cjOrder = await placeCJOrder(token, {
      orderNumber: `DRIP-${session.id.slice(-8).toUpperCase()}`,
      customerName,
      address,
      items: cjItems,
    });

    console.log(`✅ CJ order ${cjOrder.orderId} placed for Stripe session ${session.id}`);
    return res.status(200).json({ received: true, cjOrderId: cjOrder.orderId });

  } catch (err) {
    console.error("Fulfillment error:", err.message);
    return res.status(200).json({ received: true, error: err.message });
  }
};

module.exports.config = { api: { bodyParser: false } };
