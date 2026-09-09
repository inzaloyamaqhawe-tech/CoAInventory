# Chiefs of Angels Inventory — Operations System

This is the system specification for **Chiefs of Angels' internal Operations & Inventory
app** — the tool the Operations Manager and store staff use every day to run stock,
staff and orders across every branch, from a phone.

It is **Phase 3 (Multi-Branch Stock & "Stockies") and Phase 4 (Admin Operations &
Employee Dashboard)** of the *Chiefs of Angels Digital & Operations Project Plan*
(Sept 2026), specified in full. It sits alongside — but is architecturally
independent from — the public [chiefsofangels.co.za](https://chiefsofangels.co.za)
storefront and the earlier **Bolide WMS** build. See
[00-DESIGN-PRINCIPLES.md](00-DESIGN-PRINCIPLES.md) for exactly how and why this
diverges from that WMS.

## The working app

`/app` is a real, running React application — not a mockup — implementing this
spec against the full 46-product catalogue: Dashboard, Products, Stock,
Transfers, Team & Tasks, Orders, Branches, Alerts and Reports, each scoped
live to whichever of the eleven seeded staff members you sign in as. It's
genuinely responsive (a CSS breakpoint, not a device toggle) — a left sidebar
on a laptop, a bottom tab bar on a phone — and its light theme is pulled from
the actual chiefsofangels.co.za storefront rather than an invented dark
dashboard look.

```
cd app
npm install   # already done if you're picking this back up
npm run dev   # open the printed http://localhost:5173 URL
```

Data lives in the browser's localStorage (seeded on first load, then mutated
for real as you use it — adjust a stock count, advance a transfer, complete
a task) standing in for the database in [05-DATA-MODEL.md](05-DATA-MODEL.md)
until a real backend replaces it per [09-BUILD-ROADMAP.md](09-BUILD-ROADMAP.md).

## Reading order

| # | Document | What's in it |
|---|---|---|
| 00 | [DESIGN-PRINCIPLES.md](00-DESIGN-PRINCIPLES.md) | Why this is a phone-first app, not a dashboard — and the concrete UI/IA differences from Bolide WMS |
| 01 | [VISION-AND-SCOPE.md](01-VISION-AND-SCOPE.md) | Who this is for, the job-to-be-done, what's in/out of scope, how it fits the 5-phase project plan |
| 02 | [MOBILE-EXPERIENCE.md](02-MOBILE-EXPERIENCE.md) | Screen-by-screen navigation map, role-based menus, the four apps-within-the-app |
| 03 | [CORE-FEATURES.md](03-CORE-FEATURES.md) | Stock & "Stockies", transfer suggestions, staff task tracking, order tracking, branch leaderboard |
| 04 | [ALERTS-AND-INTELLIGENCE.md](04-ALERTS-AND-INTELLIGENCE.md) | The rules engine: low stock, overstock, transfer suggestions, high-demand spikes, task/order SLAs |
| 05 | [DATA-MODEL.md](05-DATA-MODEL.md) | Full entity schema + ERD, built to run as its own database |
| 06 | [API-AND-INTEGRATIONS.md](06-API-AND-INTEGRATIONS.md) | REST/webhook surface for the WooCommerce storefront, VIP system (Phase 2), POS, accounting |
| 07 | [PRODUCT-CATALOG.md](07-PRODUCT-CATALOG.md) | The 46-item live catalogue, pulled from the current shop, organised into the SKU scheme |
| 08 | [SEED-DATA.md](08-SEED-DATA.md) | Starting branches, staff, stock levels, tasks and orders to launch the system with |
| 09 | [BUILD-ROADMAP.md](09-BUILD-ROADMAP.md) | Tech stack, delivery milestones, what ships in what sprint |

## One-paragraph summary

Three roles — **Operations Manager**, **Branch Manager**, **Sales Associate** — open
one app — built phone-first, and just as clear on a tablet or PC. Staff see only their own branch and their own day: what's in stock,
what needs counting, what tasks and orders are theirs. The Operations Manager sees
every branch at once: a live stock picture across the business ("Stockies"), a
transfer board with system-generated move suggestions, a staff task board, an order
queue, and a leaderboard of which branch is selling what. The system watches stock
levels and sales velocity continuously and raises alerts — low stock, overstock,
a branch selling out of something another branch is sitting on — before anyone has
to notice and ask around on WhatsApp.
