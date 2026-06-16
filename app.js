/* ============================================================
   DRIP — fashion & beauty store
   Vanilla JS: product catalog, variant picker, cart (localStorage)
   Cart key format: "productId::color::size"
   ============================================================ */

const PRODUCTS = [
  {
    id: "women-dress",
    cjPid: "1705465925572497408",
    name: "Loose Linen Midi Dress",
    category: "women",
    badge: "Bestseller",
    price: 29.99,
    rating: 4.8,
    reviews: 283,
    description: "Breathable cotton-linen blend, relaxed fit, mid-length silhouette. Perfect for summer.",
    image: "https://oss-cf.cjdropshipping.com/product/2025/04/21/06/359a0834-5390-4e4b-b6e9-68b094ad346d.jpg",
    colors: ["Black", "Blue", "Khaki", "Orange", "Pink"],
    colorHex: { Black: "#1e293b", Blue: "#3b82f6", Khaki: "#a16207", Orange: "#fb923c", Pink: "#f9a8d4" },
    sizes: ["S", "M", "L", "XL", "2XL", "3XL"],
  },
  {
    id: "men-cargo",
    cjPid: "1670981011842273280",
    name: "Streetwear Cargo Pants",
    category: "men",
    badge: "Hot",
    price: 34.99,
    rating: 4.7,
    reviews: 1152,
    description: "Multi-pocket cargo pants with drawstring waist. Hip-hop streetwear style, all-day comfort.",
    image: "https://oss-cf.cjdropshipping.com/product/2023/09/22/07/a6f6b5a8-ca1a-4a22-9a6e-bb1a73c2e5a4.jpg",
    colors: ["Black", "Army Green", "Grey", "Khaki", "Navy"],
    colorHex: { Black: "#1e293b", "Army Green": "#4d7c0f", Grey: "#6b7280", Khaki: "#a16207", Navy: "#1e3a5f" },
    sizes: ["S", "M", "L", "XL", "2XL", "3XL"],
  },
  {
    id: "ems-tool",
    cjPid: "1914884885643104257",
    name: "EMS Facial Beauty Tool",
    category: "beauty",
    badge: "New",
    price: 59.99,
    rating: 4.9,
    reviews: 733,
    description: "V-shape facial lifting, EMS microcurrent, blue light therapy. 5 modes for a spa face at home.",
    image: "https://oss-cf.cjdropshipping.com/product/2024/05/08/09/8e2d5e20-3c45-4887-9d20-4f3e0a5e6c3b.jpg",
    colors: ["White"],
    colorHex: { White: "#f8fafc" },
    sizes: [],
  },
];

const CATEGORIES = [
  { key: "all",    label: "All" },
  { key: "women",  label: "Women" },
  { key: "men",    label: "Men" },
  { key: "beauty", label: "Beauty" },
];

const FREE_SHIP = 50;

// --- State ---
let activeCategory = "all";
let cart = loadCart(); // { "women-dress::Black::M": qty, ... }
let pickerProduct = null;
let pickerColor = null;
let pickerSize = null;

// --- Helpers ---
const $ = (sel) => document.querySelector(sel);
const fmt = (n) => `$${Number(n).toFixed(2)}`;
const stars = (r) => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));
const cartKey = (id, color, size) => size ? `${id}::${color}::${size}` : `${id}::${color}::_`;
const parseKey = (key) => { const [id, color, size] = key.split("::"); return { id, color, size: size === "_" ? "" : size }; };

function loadCart() {
  try { return JSON.parse(localStorage.getItem("drip-cart")) || {}; }
  catch { return {}; }
}
function saveCart() { localStorage.setItem("drip-cart", JSON.stringify(cart)); }

// --- Render: category filters ---
function renderFilters() {
  const wrap = $("#filters");
  wrap.innerHTML = CATEGORIES.map((c) => `
    <button class="filter ${c.key === activeCategory ? "active" : ""}" data-cat="${c.key}">${c.label}</button>
  `).join("");
  wrap.querySelectorAll(".filter").forEach((btn) =>
    btn.addEventListener("click", () => { activeCategory = btn.dataset.cat; renderFilters(); renderGrid(); })
  );
}

// --- Render: product grid ---
function renderGrid() {
  const grid = $("#productGrid");
  const items = PRODUCTS.filter((p) => activeCategory === "all" || p.category === activeCategory);
  grid.innerHTML = items.map((p) => `
    <article class="card">
      <div class="card-art">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
        <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'" />
        <div class="card-img-fallback" style="background: linear-gradient(135deg, #f1f5f9, #e2e8f0);" aria-hidden="true"></div>
      </div>
      <div class="card-body">
        <span class="card-category">${p.category}</span>
        <span class="card-name">${p.name}</span>
        <span class="card-desc">${p.description}</span>
        <span class="card-rating">${stars(p.rating)} <span class="muted">${p.rating} (${p.reviews})</span></span>
        <div class="card-foot">
          <span class="card-price">${fmt(p.price)}</span>
          <button class="add-btn" data-id="${p.id}">Add to bag</button>
        </div>
      </div>
    </article>
  `).join("");
  grid.querySelectorAll(".add-btn").forEach((btn) =>
    btn.addEventListener("click", () => openPicker(btn.dataset.id))
  );
}

// --- Variant Picker ---
function openPicker(productId) {
  pickerProduct = PRODUCTS.find((p) => p.id === productId);
  if (!pickerProduct) return;
  pickerColor = pickerProduct.colors[0];
  pickerSize = pickerProduct.sizes[0] || null;
  renderPicker();
  $("#picker").classList.add("open");
  $("#pickerOverlay").classList.add("open");
}

function closePicker() {
  $("#picker").classList.remove("open");
  $("#pickerOverlay").classList.remove("open");
  pickerProduct = null;
}

function renderPicker() {
  const p = pickerProduct;
  if (!p) return;
  $("#pickerTitle").textContent = p.name;
  $("#pickerPrice").textContent = fmt(p.price);

  // Color swatches
  const colorWrap = $("#pickerColors");
  colorWrap.innerHTML = `<p class="picker-label">Color: <strong id="colorLabel">${pickerColor}</strong></p>` +
    p.colors.map((c) => `
      <button class="swatch-btn ${c === pickerColor ? "selected" : ""}" data-color="${c}"
        style="background:${p.colorHex[c] || '#ccc'}; border:2px solid ${c === pickerColor ? '#000' : 'transparent'};"
        title="${c}"></button>
    `).join("");
  colorWrap.querySelectorAll(".swatch-btn").forEach((btn) => {
    btn.addEventListener("click", () => { pickerColor = btn.dataset.color; renderPicker(); });
  });

  // Size buttons
  const sizeWrap = $("#pickerSizes");
  if (p.sizes.length === 0) {
    sizeWrap.innerHTML = "";
  } else {
    sizeWrap.innerHTML = `<p class="picker-label">Size: <strong id="sizeLabel">${pickerSize}</strong></p>` +
      p.sizes.map((s) => `
        <button class="size-btn ${s === pickerSize ? "selected" : ""}" data-size="${s}">${s}</button>
      `).join("");
    sizeWrap.querySelectorAll(".size-btn").forEach((btn) => {
      btn.addEventListener("click", () => { pickerSize = btn.dataset.size; renderPicker(); });
    });
  }
}

function addFromPicker() {
  if (!pickerProduct) return;
  if (pickerProduct.sizes.length > 0 && !pickerSize) { showToast("Please select a size"); return; }
  const key = cartKey(pickerProduct.id, pickerColor, pickerSize);
  cart[key] = (cart[key] || 0) + 1;
  saveCart();
  updateCartUI();
  showToast(`${pickerProduct.name} added to your bag ✦`);
  closePicker();
}

// --- Cart ---
function setQty(key, delta) {
  cart[key] = (cart[key] || 0) + delta;
  if (cart[key] <= 0) delete cart[key];
  saveCart();
  updateCartUI();
}
function removeItem(key) { delete cart[key]; saveCart(); updateCartUI(); }

function cartCount() { return Object.values(cart).reduce((a, b) => a + b, 0); }
function cartSubtotal() {
  return Object.entries(cart).reduce((sum, [key, qty]) => {
    const { id } = parseKey(key);
    const p = PRODUCTS.find((x) => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}

function updateCartUI() {
  $("#cartCount").textContent = cartCount();
  const itemsWrap = $("#cartItems");
  const entries = Object.entries(cart);

  if (entries.length === 0) {
    itemsWrap.innerHTML = `<div class="cart-empty"><span>🛍️</span>Your bag is empty.<br/>Go find your fit!</div>`;
  } else {
    itemsWrap.innerHTML = entries.map(([key, qty]) => {
      const { id, color, size } = parseKey(key);
      const p = PRODUCTS.find((x) => x.id === id);
      if (!p) return "";
      const variant = [color, size].filter(Boolean).join(", ");
      return `
        <div class="cart-item">
          <div class="ci-art" style="background:${p.colorHex[color] || '#e2e8f0'}"></div>
          <div class="ci-info">
            <div class="ci-name">${p.name}</div>
            <div class="ci-price">${fmt(p.price)} · ${variant}</div>
            <div class="ci-qty">
              <button data-dec="${key}" aria-label="Decrease">−</button>
              <span>${qty}</span>
              <button data-inc="${key}" aria-label="Increase">+</button>
              <button class="ci-remove" data-rm="${key}">remove</button>
            </div>
          </div>
          <strong>${fmt(p.price * qty)}</strong>
        </div>`;
    }).join("");
  }

  itemsWrap.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => setQty(b.dataset.inc, 1)));
  itemsWrap.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => setQty(b.dataset.dec, -1)));
  itemsWrap.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => removeItem(b.dataset.rm)));

  const subtotal = cartSubtotal();
  $("#cartTotal").textContent = fmt(subtotal);
  const prog = $("#cartProgress");
  if (subtotal === 0) prog.textContent = "";
  else if (subtotal >= FREE_SHIP) prog.textContent = "🎉 You've unlocked free shipping!";
  else prog.textContent = `Add ${fmt(FREE_SHIP - subtotal)} more for free shipping.`;
}

// --- Cart drawer ---
function openCart() {
  $("#cartDrawer").classList.add("open");
  $("#cartOverlay").classList.add("open");
  $("#cartDrawer").setAttribute("aria-hidden", "false");
}
function closeCart() {
  $("#cartDrawer").classList.remove("open");
  $("#cartOverlay").classList.remove("open");
  $("#cartDrawer").setAttribute("aria-hidden", "true");
}

// --- Toast ---
let toastTimer;
function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// --- Checkout ---
async function checkout() {
  if (cartCount() === 0) { showToast("Your bag is empty!"); return; }
  const btn = $("#checkoutBtn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Taking you to checkout…";
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || "Checkout unavailable right now.");
    window.location.href = data.url;
  } catch (err) {
    showToast(err.message);
    btn.disabled = false;
    btn.textContent = original;
  }
}

// --- Init ---
function init() {
  renderFilters();
  renderGrid();
  updateCartUI();

  $("#cartBtn").addEventListener("click", openCart);
  $("#cartClose").addEventListener("click", closeCart);
  $("#cartOverlay").addEventListener("click", closeCart);
  $("#checkoutBtn").addEventListener("click", checkout);
  $("#pickerOverlay").addEventListener("click", closePicker);
  $("#pickerClose").addEventListener("click", closePicker);
  $("#pickerAddBtn").addEventListener("click", addFromPicker);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeCart(); closePicker(); }
  });

  if (new URLSearchParams(location.search).get("canceled")) {
    showToast("Checkout canceled — your bag is saved.");
    history.replaceState({}, "", location.pathname);
  }
}

document.addEventListener("DOMContentLoaded", init);
