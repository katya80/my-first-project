/* Sladko – pastry finder for Slovenia. Plain JS, no build step. */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const eur = (n) => new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR" }).format(n);

  const occasionById = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));
  const dietaryById = Object.fromEntries(DIETARY.map((d) => [d.id, d]));
  const categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
  const vendorById = Object.fromEntries(VENDORS.map((v) => [v.id, v]));

  /* ---------- storage (safe) ---------- */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore */
      }
    },
  };

  /* ---------- dates ---------- */
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = () => startOfDay(new Date());
  const toISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fromISO = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const daysUntil = (iso) => Math.round((fromISO(iso) - today()) / 86400000);
  const prettyDate = (iso) =>
    fromISO(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  /* ---------- state ---------- */
  const state = {
    q: "",
    type: "all",
    occasion: "",
    city: "",
    category: "",
    dietary: new Set(),
    needed: "",
    sort: "rating",
    favs: new Set(store.get("sladko.favs", [])),
  };
  // Per-vendor order request (items chosen in the builder)
  const requests = store.get("sladko.requests", {});
  const saveRequests = () => store.set("sladko.requests", requests);

  /* ---------- pricing ---------- */
  function itemTotal(product, sel) {
    const size = product.sizes[sel.size] || product.sizes[0];
    const extras = (sel.extras || []).reduce((sum, i) => sum + (product.extras[i]?.price || 0), 0);
    const one = size.qty ? product.basePrice * size.qty + extras : product.basePrice + size.price + extras;
    return one * (sel.count || 1);
  }
  const fromPrice = (product) => {
    const s = product.sizes[0];
    return s.qty ? product.basePrice * s.qty : product.basePrice + s.price;
  };

  /* ---------- filtering ---------- */
  function matches(v) {
    if (state.type === "fav" && !state.favs.has(v.id)) return false;
    if (state.type === "shop" || state.type === "chef") {
      if (v.type !== state.type) return false;
    }
    if (state.occasion && !v.occasions.includes(state.occasion)) return false;
    if (state.city && v.city !== state.city) return false;
    if (state.category && !v.products.some((p) => p.category === state.category)) return false;
    for (const d of state.dietary) if (!v.dietary.includes(d)) return false;
    if (state.needed && v.leadDays > daysUntil(state.needed)) return false;
    if (state.q) {
      const hay = [
        v.name,
        v.city,
        v.description,
        v.type === "chef" ? "pastry chef pick-up home" : "pastry shop slaščičarna",
        ...v.occasions.map((o) => occasionById[o]?.label),
        ...v.products.flatMap((p) => [p.name, p.description, ...p.flavours]),
      ]
        .join(" ")
        .toLowerCase();
      const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  const sorters = {
    rating: (a, b) => b.rating - a.rating,
    "price-asc": (a, b) => a.price - b.price || b.rating - a.rating,
    "price-desc": (a, b) => b.price - a.price || b.rating - a.rating,
    lead: (a, b) => a.leadDays - b.leadDays,
    name: (a, b) => a.name.localeCompare(b.name, "sl"),
  };

  /* ---------- rendering: filters ---------- */
  function renderFilters() {
    $("#occasions").innerHTML = OCCASIONS.map(
      (o) =>
        `<button type="button" class="chip" data-occasion="${o.id}" aria-pressed="false"><span aria-hidden="true">${o.icon}</span> ${esc(o.label)}</button>`
    ).join("");

    const cities = [...new Set(VENDORS.map((v) => v.city))].sort((a, b) => a.localeCompare(b, "sl"));
    $("#city").insertAdjacentHTML("beforeend", cities.map((c) => `<option>${esc(c)}</option>`).join(""));
    $("#category").insertAdjacentHTML(
      "beforeend",
      CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("")
    );
    $("#dietary").innerHTML = DIETARY.map(
      (d) => `<label class="check"><input type="checkbox" value="${d.id}" /> ${esc(d.label)}</label>`
    ).join("");
    $("#needed").min = toISO(today());
  }

  function syncFilterUI() {
    $$("#occasions .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.occasion === state.occasion)));
    $$(".tabs [role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.type === state.type)));
  }

  /* ---------- rendering: cards ---------- */
  const stars = (r) => `<span class="rating" title="${r} out of 5">★ ${r.toFixed(1)}</span>`;
  const priceLevel = (n) => `<span class="price" title="Price level">${"€".repeat(n)}<span class="dim">${"€".repeat(3 - n)}</span></span>`;
  const typeBadge = (v) =>
    v.type === "chef"
      ? `<span class="badge chef">Pastry chef · pick-up</span>`
      : `<span class="badge shop">Pastry shop</span>`;

  function card(v) {
    const fav = state.favs.has(v.id);
    const minPrice = Math.min(...v.products.map(fromPrice));
    return `
      <article class="card" data-id="${v.id}">
        <div class="card-top" style="--accent:${v.color}">
          <span class="card-emoji" aria-hidden="true">${v.emoji}</span>
          <button type="button" class="fav ${fav ? "on" : ""}" data-fav="${v.id}" aria-pressed="${fav}" aria-label="${fav ? "Remove from" : "Save to"} favourites">♥</button>
        </div>
        <div class="card-body">
          ${typeBadge(v)}
          <h3>${esc(v.name)}</h3>
          <p class="meta">📍 ${esc(v.city)} · ${stars(v.rating)} · ${priceLevel(v.price)}</p>
          <p class="desc">${esc(v.description)}</p>
          <p class="occ" aria-label="Occasions">${v.occasions.map((o) => `<span title="${esc(occasionById[o].label)}">${occasionById[o].icon}</span>`).join("")}</p>
          <ul class="tags">
            <li>⏱ ${v.leadDays} day${v.leadDays > 1 ? "s" : ""} notice</li>
            <li>${v.type === "chef" ? "🤝 Pick-up only" : v.delivery ? "🚚 Delivery available" : "🏪 Pick-up in shop"}</li>
            ${v.dietary.map((d) => `<li class="diet">${esc(dietaryById[d].label)}</li>`).join("")}
          </ul>
          <p class="from">From <strong>${eur(minPrice)}</strong></p>
        </div>
        <div class="card-actions">
          <button type="button" class="btn primary" data-open="${v.id}">Choose &amp; order</button>
          <a class="btn ghost" href="tel:${v.phone.replace(/\s/g, "")}" aria-label="Call ${esc(v.name)}">📞 Call</a>
        </div>
      </article>`;
  }

  function render() {
    syncFilterUI();
    const list = VENDORS.filter(matches).sort(sorters[state.sort]);
    const shops = list.filter((v) => v.type === "shop").length;
    const chefs = list.length - shops;
    $("#result-count").textContent = list.length
      ? `${list.length} result${list.length > 1 ? "s" : ""} · ${shops} shop${shops !== 1 ? "s" : ""}, ${chefs} chef${chefs !== 1 ? "s" : ""}`
      : "";
    $("#results").innerHTML = list.length
      ? list.map(card).join("")
      : `<div class="empty"><p>😕 No sweets match these filters.</p><p class="muted">${
          state.type === "fav" ? "Tap ♥ on a listing to save it here." : "Try another city, a later date or fewer dietary filters."
        }</p><button type="button" class="btn ghost" data-reset>Reset filters</button></div>`;
  }

  /* ---------- vendor dialog ---------- */
  const dialog = $("#vendor-dialog");
  let current = null;

  function contactBlock(v) {
    const tel = v.phone.replace(/\s/g, "");
    const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address)}`;
    return `
      <div class="contact">
        <a class="btn ghost" href="tel:${tel}">📞 ${esc(v.phone)}</a>
        <a class="btn ghost" href="mailto:${esc(v.email)}">✉️ E-mail</a>
        <a class="btn ghost" href="https://wa.me/${esc(v.whatsapp)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="btn ghost" href="viber://chat?number=%2B${esc(v.whatsapp)}">📱 Viber</a>
        ${v.website ? `<a class="btn ghost" href="${esc(v.website)}" target="_blank" rel="noopener">🌐 Website</a>` : ""}
        ${v.instagram ? `<a class="btn ghost" href="https://instagram.com/${esc(v.instagram)}" target="_blank" rel="noopener">📸 Instagram</a>` : ""}
        <a class="btn ghost" href="${maps}" target="_blank" rel="noopener">🗺️ Directions</a>
      </div>`;
  }

  function productBlock(v, p) {
    const sizes = p.sizes.map((s, i) => `<option value="${i}">${esc(s.label)}</option>`).join("");
    const flavours = p.flavours.map((f) => `<option>${esc(f)}</option>`).join("");
    const extras = p.extras
      .map(
        (x, i) =>
          `<label class="check"><input type="checkbox" name="extra" value="${i}" /> ${esc(x.label)} <span class="muted">${x.price ? "+" + eur(x.price) : "free"}</span></label>`
      )
      .join("");
    return `
      <form class="product" data-product="${p.id}">
        <div class="product-head">
          <div>
            <h4>${esc(p.name)}</h4>
            <p class="muted small">${esc(categoryById[p.category].label)}${p.dietary.length ? " · " + p.dietary.map((d) => dietaryById[d].label).join(", ") : ""}</p>
          </div>
          <output class="product-price" name="price">${eur(fromPrice(p))}</output>
        </div>
        <p class="small">${esc(p.description)}</p>
        <div class="opts">
          <label>Size<select name="size">${sizes}</select></label>
          ${p.flavours.length > 1 ? `<label>Flavour<select name="flavour">${flavours}</select></label>` : `<input type="hidden" name="flavour" value="${esc(p.flavours[0] || "")}" />`}
          <label>Quantity<input name="count" type="number" min="1" max="50" value="1" inputmode="numeric" /></label>
        </div>
        ${extras ? `<fieldset class="extras"><legend>Extras</legend>${extras}</fieldset>` : ""}
        <button type="submit" class="btn primary small-btn">+ Add to request</button>
      </form>`;
  }

  function readSelection(form, p) {
    return {
      product: p.id,
      size: Number(form.size.value),
      flavour: form.flavour.value,
      count: Math.max(1, Math.min(50, parseInt(form.count.value, 10) || 1)),
      extras: $$("input[name=extra]:checked", form).map((c) => Number(c.value)),
    };
  }

  function describeItem(v, item) {
    const p = v.products.find((x) => x.id === item.product);
    if (!p) return null;
    const parts = [p.sizes[item.size].label];
    if (item.flavour) parts.push(item.flavour);
    if (item.extras.length) parts.push("+ " + item.extras.map((i) => p.extras[i].label).join(", "));
    return { p, title: `${item.count} × ${p.name}`, detail: parts.join(" · "), total: itemTotal(p, item) };
  }

  function renderRequest(v) {
    const items = requests[v.id] || [];
    const box = $("#request-items", dialog);
    if (!items.length) {
      box.innerHTML = `<p class="muted small">Nothing added yet — choose pastries above, or just describe your wish in the message.</p>`;
      $("#request-total", dialog).textContent = "";
      return;
    }
    let sum = 0;
    box.innerHTML = `<ul class="req-list">${items
      .map((it, idx) => {
        const d = describeItem(v, it);
        if (!d) return "";
        sum += d.total;
        return `<li><div><strong>${esc(d.title)}</strong><br /><span class="muted small">${esc(d.detail)}</span></div>
          <div class="req-right">${eur(d.total)} <button type="button" class="link-btn" data-remove="${idx}" aria-label="Remove ${esc(d.p.name)}">✕</button></div></li>`;
      })
      .join("")}</ul>`;
    $("#request-total", dialog).innerHTML = `Estimated total: <strong>${eur(sum)}</strong> <span class="muted small">(final price confirmed by vendor)</span>`;
  }

  function openVendor(id, { push = true } = {}) {
    const v = vendorById[id];
    if (!v) return;
    current = v;
    const minDate = toISO(addDays(today(), v.leadDays));
    const prefDate = state.needed && state.needed >= minDate ? state.needed : "";
    const saved = store.get("sladko.customer", {});

    $("#dlg-body").innerHTML = `
      <div class="dlg-hero" style="--accent:${v.color}">
        <span class="card-emoji" aria-hidden="true">${v.emoji}</span>
      </div>
      ${typeBadge(v)}
      <h2 id="dlg-title">${esc(v.name)}</h2>
      <p class="meta">📍 ${esc(v.address)} · ${stars(v.rating)} · ${priceLevel(v.price)}</p>
      <p>${esc(v.description)}</p>
      <ul class="tags">
        <li>🕒 ${esc(v.hours)}</li>
        <li>⏱ Order at least ${v.leadDays} day${v.leadDays > 1 ? "s" : ""} ahead</li>
        <li>${v.type === "chef" ? "🤝 Pick-up only" : v.delivery ? "🚚 Delivery or pick-up" : "🏪 Pick-up in shop"}</li>
      </ul>

      <h3 class="sub">Contact</h3>
      ${contactBlock(v)}

      <h3 class="sub">Choose your pastries</h3>
      <div class="products">${v.products.map((p) => productBlock(v, p)).join("")}</div>

      <h3 class="sub">Your order request</h3>
      <div id="request-items"></div>
      <p id="request-total" class="total"></p>

      <form id="request-form" class="request-form" novalidate>
        <div class="opts">
          <label>Your name*<input name="name" required autocomplete="name" value="${esc(saved.name || "")}" /></label>
          <label>Phone*<input name="phone" type="tel" required autocomplete="tel" value="${esc(saved.phone || "")}" placeholder="+386 …" /></label>
          <label>Date needed*<input name="date" type="date" required min="${minDate}" value="${prefDate}" /></label>
          <label>${v.type === "chef" || !v.delivery ? "Pick-up time" : "Pick-up / delivery"}
            ${
              v.type !== "chef" && v.delivery
                ? `<select name="handover"><option>Pick-up</option><option>Delivery</option></select>`
                : `<input name="handover" placeholder="e.g. around 10:00" />`
            }
          </label>
          <label>Occasion<select name="occasion"><option value="">—</option>${v.occasions
            .map((o) => `<option value="${o}" ${o === state.occasion ? "selected" : ""}>${esc(occasionById[o].label)}</option>`)
            .join("")}</select></label>
        </div>
        <label class="block">Message / special wishes
          <textarea name="message" rows="3" placeholder="Design ideas, inscription, allergies, number of guests…"></textarea>
        </label>
        <p class="form-error" role="alert" hidden></p>
        <div class="send">
          <button type="submit" class="btn primary" data-via="email">✉️ Send by e-mail</button>
          <button type="submit" class="btn wa" data-via="whatsapp">💬 Send via WhatsApp</button>
          <button type="submit" class="btn ghost" data-via="copy">📋 Copy message</button>
        </div>
        <p class="muted small">Your message opens in your own e-mail or WhatsApp app — nothing is sent until you press send there.</p>
      </form>`;

    renderRequest(v);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    $(".dlg", dialog).scrollTop = 0;
    if (push) history.replaceState(null, "", `#${v.id}`);
  }

  function closeVendor() {
    if (dialog.open) dialog.close();
  }

  function buildMessage(v, data) {
    const items = (requests[v.id] || []).map((it) => describeItem(v, it)).filter(Boolean);
    const lines = [`Hello ${v.name},`, "", "I would like to order:"];
    if (items.length) {
      let sum = 0;
      items.forEach((d) => {
        sum += d.total;
        lines.push(`• ${d.title} (${d.detail}) – approx. ${eur(d.total)}`);
      });
      lines.push(`Estimated total: ${eur(sum)}`);
    } else {
      lines.push("(see message below)");
    }
    lines.push("");
    lines.push(`Date needed: ${prettyDate(data.date)}`);
    if (data.handover) lines.push(`${v.type === "chef" || !v.delivery ? "Pick-up time" : "Pick-up / delivery"}: ${data.handover}`);
    if (data.occasion) lines.push(`Occasion: ${occasionById[data.occasion].label}`);
    if (data.message) lines.push("", data.message);
    lines.push("", "Please confirm availability and the final price.", "", `Thank you,`, data.name, data.phone);
    return lines.join("\n");
  }

  function submitRequest(form, via) {
    const v = current;
    const err = $(".form-error", form);
    const data = Object.fromEntries(new FormData(form).entries());
    data.name = (data.name || "").trim();
    data.phone = (data.phone || "").trim();
    data.message = (data.message || "").trim();

    const problems = [];
    if (!data.name) problems.push("your name");
    if (!data.phone) problems.push("a phone number");
    if (!data.date) problems.push("the date you need it");
    if (!(requests[v.id] || []).length && !data.message) problems.push("at least one pastry or a message");
    if (data.date && daysUntil(data.date) < v.leadDays) {
      err.textContent = `${v.name} needs at least ${v.leadDays} day${v.leadDays > 1 ? "s" : ""} notice — please choose ${prettyDate(form.date.min)} or later.`;
      err.hidden = false;
      return;
    }
    if (problems.length) {
      err.textContent = `Please add ${problems.join(", ")}.`;
      err.hidden = false;
      return;
    }
    err.hidden = true;
    store.set("sladko.customer", { name: data.name, phone: data.phone });

    const msg = buildMessage(v, data);
    if (via === "email") {
      const subject = `Order request – ${prettyDate(data.date)}`;
      window.location.href = `mailto:${v.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
    } else if (via === "whatsapp") {
      window.open(`https://wa.me/${v.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    } else {
      copyText(msg).then(
        () => toast("Message copied — paste it into SMS, Viber or e-mail."),
        () => toast("Could not copy automatically. Please select the text manually.")
      );
    }
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("copy failed");
  }

  let toastTimer;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---------- events ---------- */
  function bind() {
    let qTimer;
    $("#search").addEventListener("input", (e) => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        state.q = e.target.value.trim();
        render();
      }, 120);
    });

    $("#occasions").addEventListener("click", (e) => {
      const b = e.target.closest("[data-occasion]");
      if (!b) return;
      state.occasion = state.occasion === b.dataset.occasion ? "" : b.dataset.occasion;
      render();
    });

    $(".tabs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-type]");
      if (!b) return;
      state.type = b.dataset.type;
      render();
    });

    $("#city").addEventListener("change", (e) => ((state.city = e.target.value), render()));
    $("#category").addEventListener("change", (e) => ((state.category = e.target.value), render()));
    $("#sort").addEventListener("change", (e) => ((state.sort = e.target.value), render()));
    $("#needed").addEventListener("change", (e) => ((state.needed = e.target.value), render()));
    $("#dietary").addEventListener("change", (e) => {
      const c = e.target;
      c.checked ? state.dietary.add(c.value) : state.dietary.delete(c.value);
      render();
    });

    const reset = () => {
      Object.assign(state, { q: "", occasion: "", city: "", category: "", needed: "", sort: "rating" });
      state.dietary.clear();
      if (state.type === "fav") state.type = "all";
      $("#search").value = "";
      $("#city").value = "";
      $("#category").value = "";
      $("#needed").value = "";
      $("#sort").value = "rating";
      $$("#dietary input").forEach((c) => (c.checked = false));
      render();
    };
    $("#reset").addEventListener("click", reset);

    $("#results").addEventListener("click", (e) => {
      const fav = e.target.closest("[data-fav]");
      if (fav) {
        const id = fav.dataset.fav;
        state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
        store.set("sladko.favs", [...state.favs]);
        toast(state.favs.has(id) ? "Saved to favourites ♥" : "Removed from favourites");
        render();
        return;
      }
      if (e.target.closest("[data-reset]")) return reset();
      const open = e.target.closest("[data-open]");
      if (open) openVendor(open.dataset.open);
    });

    // Dialog: live price, add item, remove item, submit
    dialog.addEventListener("input", (e) => {
      const form = e.target.closest("form.product");
      if (!form || !current) return;
      const p = current.products.find((x) => x.id === form.dataset.product);
      form.price.value = eur(itemTotal(p, readSelection(form, p)));
    });

    dialog.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target;
      if (form.matches("form.product")) {
        const p = current.products.find((x) => x.id === form.dataset.product);
        (requests[current.id] ||= []).push(readSelection(form, p));
        saveRequests();
        renderRequest(current);
        toast(`Added ${p.name}`);
      } else if (form.id === "request-form") {
        submitRequest(form, e.submitter?.dataset.via || "email");
      }
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.closest("[data-close]")) return closeVendor();
      const rm = e.target.closest("[data-remove]");
      if (rm && current) {
        requests[current.id].splice(Number(rm.dataset.remove), 1);
        saveRequests();
        renderRequest(current);
      }
    });

    dialog.addEventListener("close", () => {
      current = null;
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    });

    window.addEventListener("hashchange", () => {
      const id = location.hash.slice(1);
      if (vendorById[id]) openVendor(id, { push: false });
      else closeVendor();
    });
  }

  /* ---------- init ---------- */
  renderFilters();
  bind();
  render();
  const initial = location.hash.slice(1);
  if (vendorById[initial]) openVendor(initial, { push: false });
})();
