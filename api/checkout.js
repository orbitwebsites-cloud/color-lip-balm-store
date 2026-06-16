// Vercel serverless function: create a Stripe Checkout Session.
// Runs server-side so the secret key and prices are never exposed to the browser.
//
// Requires env var STRIPE_SECRET_KEY (set in Vercel → Project → Settings → Environment Variables).

const Stripe = require("stripe");

// Authoritative price list. Cart keys are "productId::color::size" — we parse
// the productId prefix and look up price here so it can't be tampered client-side.
// Prices in cents (USD). Keep in sync with app.js PRODUCTS.
const CATALOG = {
  "women-dress": { name: "Loose Linen Midi Dress",    amount: 2999 },
  "men-cargo":   { name: "Streetwear Cargo Pants",    amount: 3499 },
  "ems-tool":    { name: "EMS Facial Beauty Tool",    amount: 5999 },
};

const FREE_SHIP_THRESHOLD = 5000; // $50.00 in cents
const STANDARD_SHIPPING = 599;    // $5.99 in cents

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({
      error: "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.",
    });
  }

  try {
    const stripe = new Stripe(secret);
    const items = (req.body && req.body.items) || {};

    const line_items = Object.entries(items)
      .map(([cartKey, qty]) => {
        // cartKey format: "productId::color::size"
        const productId = cartKey.split("::")[0];
        const product = CATALOG[productId];
        const quantity = parseInt(qty, 10);
        if (!product || !quantity || quantity < 1) return null;
        const [, color, size] = cartKey.split("::");
        const variantLabel = [color, size && size !== "_" ? size : null].filter(Boolean).join(" / ");
        return {
          quantity: Math.min(quantity, 99),
          price_data: {
            currency: "usd",
            unit_amount: product.amount,
            product_data: { name: variantLabel ? `${product.name} — ${variantLabel}` : product.name },
          },
        };
      })
      .filter(Boolean);

    if (line_items.length === 0) {
      return res.status(400).json({ error: "Your cart is empty." });
    }

    const subtotal = line_items.reduce(
      (sum, li) => sum + li.price_data.unit_amount * li.quantity,
      0
    );
    const shippingAmount = subtotal >= FREE_SHIP_THRESHOLD ? 0 : STANDARD_SHIPPING;

    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : "");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      metadata: { cart: JSON.stringify(items) }, // read by webhook.js for CJ fulfillment
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "IE", "NZ"],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: shippingAmount, currency: "usd" },
            display_name: shippingAmount === 0 ? "Free shipping" : "Standard shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        },
      ],
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return res.status(500).json({ error: "Could not start checkout. Please try again." });
  }
};
