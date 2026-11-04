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
