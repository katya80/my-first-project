
# my-first-project<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sladko – Pastry Finder Slovenia</title>
  <meta name="description" content="Find quality pastry shops and pastry chefs in Slovenia for every occasion." />
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <header class="hero">
    <div class="hero-inner">
      <h1><span aria-hidden="true">🍰</span> Sladko</h1>
      <p class="tagline">Quality sweets for every occasion — pastry shops &amp; pastry chefs across Slovenia.</p>
      <label class="search">
        <span class="sr-only">Search</span>
        <input id="search" type="search" placeholder="Search potica, wedding cake, Ljubljana…" autocomplete="off" />
      </label>
    </div>
  </header>

  <main class="container">
    <section aria-labelledby="occ-title">
      <h2 id="occ-title" class="section-title">What's the occasion?</h2>
      <div id="occasions" class="chips" role="group" aria-label="Occasions"></div>
    </section>

    <nav class="tabs" role="tablist" aria-label="Vendor type">
      <button role="tab" data-type="all" aria-selected="true">All</button>
      <button role="tab" data-type="shop" aria-selected="false">🏪 Pastry shops</button>
      <button role="tab" data-type="chef" aria-selected="false">👩‍🍳 Pastry chefs <small>(pick-up)</small></button>
      <button role="tab" data-type="fav" aria-selected="false">♥ Saved</button>
    </nav>

    <section class="filters" aria-label="Filters">
      <label>City
        <select id="city"><option value="">All of Slovenia</option></select>
      </label>
      <label>Pastry type
        <select id="category"><option value="">Any</option></select>
      </label>
      <label>Needed by
        <input id="needed" type="date" />
      </label>
      <label>Sort
        <select id="sort">
          <option value="rating">Best rated</option>
          <option value="price-asc">Price: low → high</option>
          <option value="price-desc">Price: high → low</option>
          <option value="lead">Shortest notice</option>
          <option value="name">Name A–Z</option>
        </select>
      </label>
      <fieldset class="dietary">
        <legend>Dietary</legend>
        <div id="dietary"></div>
      </fieldset>
      <button id="reset" class="link-btn" type="button">Reset filters</button>
    </section>

    <p id="result-count" class="result-count" aria-live="polite"></p>
    <section id="results" class="grid" aria-label="Results"></section>
  </main>

  <!-- Vendor detail / order builder -->
  <dialog id="vendor-dialog" aria-labelledby="dlg-title">
    <div class="dlg">
      <button class="close" type="button" aria-label="Close" data-close>×</button>
      <div id="dlg-body"></div>
    </div>
  </dialog>

  <footer class="footer">
    <p>Sladko · Made for sweet tooths in Slovenia 🇸🇮</p>
    <p class="muted">All listings shown are sample data for demonstration. Prices are indicative — always confirm with the vendor.</p>
  </footer>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>

  <script src="js/data.js"></script>
  <script src="js/app.js"></script>
</body>
</html>

# Sladko – Pastry Finder Slovenia 🍰

A small web app for quickly finding good-quality sweets in Slovenia for any occasion.

## Features

- **Pastry shops** (slaščičarne) and **independent pastry chefs** (pick-up only), in separate tabs
- **Quick find by occasion**: birthday, wedding, baptism & communion, Christmas & Easter, corporate, anniversary
- **Filters**: city, pastry type, dietary needs (gluten-free, vegan, lactose-free, no added sugar), and a
  "needed by" date that hides vendors who need more notice
- **Search** across vendors, products and flavours (e.g. "potica", "vegan", "Maribor")
- **Choose your pastries**: size, flavour, quantity and extras, with a live price estimate
- **Order request**: collects your picks, date and wishes into a ready-made message you can
  send by **e-mail** or **WhatsApp**, or copy for SMS/Viber
- **Contact options** for every vendor: call, e-mail, WhatsApp, Viber, website/Instagram, map directions
- **Saved ♥ favourites** and remembered order requests (stored in your browser)
- Works on phones, supports dark mode, no build step or server needed

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000. A vendor can be linked directly, e.g. `index.html#chef-ana`.

## Adding real shops and chefs

All listings in `js/data.js` are **fictional sample data** (names, phone numbers and e-mails are placeholders).
Replace them with real, verified businesses (with their permission) before publishing. Each vendor entry
documents its fields at the top of that file; products can define `sizes`, `flavours` and `extras`.
Sizes with a `qty` are priced as `basePrice × qty`; other sizes add their `price` to `basePrice`.

## Files

- `index.html` – page layout
- `css/styles.css` – styles
- `js/data.js` – vendors, occasions, dietary options, categories
- `js/app.js` – filtering, vendor details, order builder and contact logic
