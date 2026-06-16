/* ============================================================
   color — lip balm store
   Vanilla JS: product catalog, color filtering, cart (localStorage)
   ============================================================ */

// --- Product catalog: lip balms named after their color ---
const PRODUCTS = [
  { id: "rosewood",   name: "Rosewood",   color: "#ff5d8f", family: "pink",    flavor: "Strawberry + shea",        price: 9,  rating: 4.9, reviews: 1820, badge: "Bestseller" },
  { id: "coral-crush",name: "Coral Crush",color: "#ff8a5b", family: "orange",  flavor: "Mango + jojoba",           price: 9,  rating: 4.8, reviews: 1204, badge: "" },
  { id: "honey",      name: "Honey",      color: "#fbbf24", family: "yellow",  flavor: "Vanilla honey",            price: 8,  rating: 4.7, reviews: 940,  badge: "" },
  { id: "lavender",   name: "Lavender",   color: "#c084fc", family: "purple",  flavor: "Lavender + vitamin E",     price: 10, rating: 4.9, reviews: 1560, badge: "New" },
  { id: "cherry",     name: "Cherry",     color: "#f43f5e", family: "red",     flavor: "Wild cherry",              price: 9,  rating: 4.8, reviews: 2110, badge: "Bestseller" },
  { id: "mint",       name: "Mint",       color: "#34d399", family: "green",   flavor: "Cool peppermint",          price: 8,  rating: 4.6, reviews: 720,  badge: "" },
  { id: "sky",        name: "Sky",        color: "#60a5fa", family: "blue",    flavor: "Blueberry frost",          price: 10, rating: 4.7, reviews: 510,  badge: "New" },
  { id: "cocoa",      name: "Cocoa",      color: "#a16207", family: "neutral", flavor: "Chocolate + cocoa butter", price: 9,  rating: 4.9, reviews: 1340, badge: "" },
  { id: "bubblegum",  name: "Bubblegum",  color: "#f9a8d4", family: "pink",    flavor: "Sweet bubblegum",          price: 8,  rating: 4.5, reviews: 660,  badge: "" },
  { id: "plum",       name: "Plum",       color: "#9333ea", family: "purple",  flavor: "Sugar plum",               price: 10, rating: 4.8, reviews: 880,  badge: "" },
  { id: "tangerine",  name: "Tangerine",  color: "#fb923c", family: "orange",  flavor: "Citrus zest",              price: 9,  rating: 4.7, reviews: 430,  badge: "" },
  { id: "midnight",   name: "Midnight",   color: "#1e293b", family: "neutral", flavor: "Clear gloss + mint",       price: 11, rating: 4.9, reviews: 290,  badge: "Limited" },
];

const FAMILIES = [
  { key: "all",     label: "All shades", swatch: "" },
  { key: "pink",    label: "Pink",    swatch: "#ff5d8f" },
  { key: "red",     label: "Red",     swatch: "#f43f5e" },
  { key: "orange",  label: "Orange",  swatch: "#fb923c" },
  { key: "yellow",  label: "Yellow",  swatch: "#fbbf24" },
  { key: "green",   label: "Green",   swatch: "#34d399" },
  { key: "blue",    label: "Blue",    swatch: "#60a5fa" },
  { key: "purple",  label: "Purple",  swatch: "#c084fc" },
  { key: "neutral", label: "Neutral", swatch: "#a16207" },
];

const FREE_SHIP = 25;

// --- State ---
let activeFilter = "all";
let cart = loadCart();

// --- Helpers ---
const $ = (sel) => document.querySelector(sel);
const fmt = (n) => `$${n.toFixed(2)}`;
const stars = (r) => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));

function loadCart() {
  try { return JSON.parse(localStorage.getItem("color-cart")) || {}; }
  catch { return {}; }
}
function saveCart() { localStorage.setItem("color-cart", JSON.stringify(cart)); }

// --- Render: filters ---
function renderFilters() {
  const wrap = $("#filters");
  wrap.innerHTML = FAMILIES.map((f) => `
    <button class="filter ${f.key === activeFilter ? "active" : ""}" data-family="${f.key}">
      ${f.swatch ? `<span class="swatch" style="background:${f.swatch}"></span>` : ""}${f.label}
    </button>
  `).join("");
  wrap.querySelectorAll(".filter").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.family;
      renderFilters();
      renderGrid();
    })
  );
}

// --- Render: product grid ---
function renderGrid() {
  const grid = $("#productGrid");
  const items = PRODUCTS.filter((p) => activeFilter === "all" || p.family === activeFilter);
  grid.innerHTML = items.map((p) => `
    <article class="card">
      <div class="card-art" style="background: radial-gradient(circle at 50% 120%, color-mix(in srgb, ${p.color} 22%, white), var(--surface));">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
        <div class="card-balm" style="--c:${p.color}"></div>
      </div>
      <div class="card-body">
        <span class="card-name">${p.name}</span>
        <span class="card-flavor">${p.flavor}</span>
        <span class="card-rating">${stars(p.rating)} <span class="muted">${p.rating} (${p.reviews})</span></span>
        <div class="card-foot">
          <span class="card-price">${fmt(p.price)}</span>
          <button class="add-btn" data-id="${p.id}">Add to bag</button>
        </div>
      </div>
    </article>
  `).join("");
  grid.querySelectorAll(".add-btn").forEach((btn) =>
    btn.addEventListener("click", () => addToCart(btn.dataset.id))
  );
}

// --- Cart logic ---
function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  updateCartUI();
  const p = PRODUCTS.find((x) => x.id === id);
  showToast(`${p.name} added to your bag ✦`);
}
function setQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  saveCart();
  updateCartUI();
}
function removeItem(id) { delete cart[id]; saveCart(); updateCartUI(); }

function cartCount() { return Object.values(cart).reduce((a, b) => a + b, 0); }
function cartSubtotal() {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = PRODUCTS.find((x) => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}

function updateCartUI() {
  $("#cartCount").textContent = cartCount();

  const itemsWrap = $("#cartItems");
  const entries = Object.entries(cart);
  if (entries.length === 0) {
    itemsWrap.innerHTML = `<div class="cart-empty"><span>💄</span>Your bag is empty.<br/>Go find your shade!</div>`;
  } else {
    itemsWrap.innerHTML = entries.map(([id, qty]) => {
      const p = PRODUCTS.find((x) => x.id === id);
      if (!p) return "";
      return `
        <div class="cart-item">
          <div class="ci-art" style="--c:${p.color}"></div>
          <div class="ci-info">
            <div class="ci-name">${p.name}</div>
            <div class="ci-price">${fmt(p.price)} · ${p.flavor}</div>
            <div class="ci-qty">
              <button data-dec="${id}" aria-label="Decrease">−</button>
              <span>${qty}</span>
              <button data-inc="${id}" aria-label="Increase">+</button>
              <button class="ci-remove" data-rm="${id}">remove</button>
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

// --- Cart drawer open/close ---
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

// --- Checkout (demo) ---
function checkout() {
  if (cartCount() === 0) { showToast("Your bag is empty!"); return; }
  showToast(`Order placed! ${cartCount()} balm(s) on the way 💕`);
  cart = {};
  saveCart();
  updateCartUI();
  setTimeout(closeCart, 900);
}

// --- Wire up ---
function init() {
  renderFilters();
  renderGrid();
  updateCartUI();
  $("#cartBtn").addEventListener("click", openCart);
  $("#cartClose").addEventListener("click", closeCart);
  $("#cartOverlay").addEventListener("click", closeCart);
  $("#checkoutBtn").addEventListener("click", checkout);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });
}

document.addEventListener("DOMContentLoaded", init);
