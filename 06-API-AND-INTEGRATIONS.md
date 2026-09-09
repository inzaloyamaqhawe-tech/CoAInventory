# API & Future Integrations

Built API-first: the mobile app is itself just the first consumer of this API, not
a special case. Versioned REST (`/api/v1/...`) plus webhooks for anything
event-driven, so this system can plug into what already exists and what's planned.

## Why this matters now, not later

chiefsofangels.co.za already runs on **WordPress/WooCommerce** (visible from the
site's "My account" / "Checkout" structure). Phase 1 of the project plan fixes that
site and adds client sign-up; Phase 2 layers VIP access on top of it. None of that
should require re-keying products or rebuilding customer data here — this system's
job is to be the operational source of truth for *stock and staff*, and to stay in
sync with WooCommerce as the source of truth for *catalogue presentation and
customer accounts*.

## REST API surface (v1)

| Resource | Endpoints | Consumers |
|---|---|---|
| `/branches` | `GET`, `GET /:id` | App, future reporting tools |
| `/staff` | `GET`, `POST`, `PATCH /:id` | App (admin), future HR/payroll tie-in |
| `/products` | `GET`, `POST`, `PATCH /:id` | App, WooCommerce sync job |
| `/products/:id/variants` | `GET`, `POST`, `PATCH /:id` | App, WooCommerce sync job |
| `/stock` | `GET ?branch_id=&variant_id=`, `PATCH /:id` (count adjust) | App, future POS |
| `/stock/movements` | `GET`, `POST` | App, POS sale events |
| `/transfers` | `GET`, `POST`, `PATCH /:id` (status change) | App |
| `/orders` | `GET`, `POST`, `PATCH /:id` | App, WooCommerce order webhook |
| `/tasks` | `GET`, `POST`, `PATCH /:id` | App |
| `/alerts` | `GET`, `PATCH /:id` (acknowledge/resolve) | App |
| `/insights/leaderboard` | `GET ?period=` | App |
| `/insights/sell-through` | `GET ?branch_id=&product_id=` | App |

All endpoints scoped by the caller's role/branch server-side (a Sales Associate's
token simply cannot pull another branch's data — enforced in the API layer, not
just hidden in the UI).

## Inbound webhooks (things happening elsewhere that this system needs to know)

| Event | Source | Effect here |
|---|---|---|
| `order.created` | WooCommerce (once Phase 1 ships) | Creates an `order` row (`source: online`), reserves stock (`qty_reserved`), assigns to the fulfilling branch/warehouse |
| `order.cancelled` | WooCommerce | Releases reserved stock, marks order cancelled |
| `payment.completed` | WooCommerce/payment gateway | Confirms order, moves `new → packed`-eligible |
| `pos.sale` | Future in-store POS (e.g. Yoco/Zapper — common SA retail POS) | Writes a `stock_movement` (`type: sale`) automatically instead of a manual count correction |

## Fetching data from WooCommerce (pull, not just push)

Webhooks cover *new* events going forward, but this system also needs to
**fetch data directly from the WooCommerce REST API** (`GET` calls against
`/wp-json/wc/v3/...` on chiefsofangels.co.za), not rely on webhooks alone:

| What's fetched | WooCommerce endpoint | Why a pull, not just a webhook |
|---|---|---|
| Existing catalogue | `GET /products`, `GET /products/{id}/variations` | **Bootstrap** — the very first sync, importing everything already live on the storefront into `product`/`product_variant` rather than starting empty and waiting for edits |
| Existing customers | `GET /customers` | Bootstrap for `customer` (and later `vip_status`) once Phase 1/2 sign-up is live, so this system isn't blind to accounts that already existed |
| Order history | `GET /orders` | Bootstrap, and a **reconciliation pass** (e.g. nightly) that fetches recent orders and diffs them against local `order` rows — catches anything a missed or failed `order.created` webhook would otherwise silently drop |
| A single product/order on demand | `GET /products/{id}`, `GET /orders/{id}` | Looked up live when a `woocommerce_id` reference needs the current WooCommerce-side detail — e.g. an Ops Manager opening an online order in this system pulls its latest WooCommerce status rather than trusting a possibly-stale local copy |

This makes the sync genuinely two-way and self-healing: webhooks keep things
current in real time, scheduled *and* on-demand fetches are the backstop that
catches whatever a webhook missed and does the one-time import when the
integration is first switched on. Both directions authenticate with the same
scoped WooCommerce API key described under **Auth** below.

## Outbound webhooks / events (things this system tells the outside world)

| Event | Destination | Purpose |
|---|---|---|
| `stock.updated` | WooCommerce | Keeps the online storefront's "in stock"/"sold out" badges accurate against real branch+warehouse stock, not a stale manual count |
| `product.created` / `product.updated` | WooCommerce | Central catalogue edits here push out to the shop, so products are entered once |
| `new_stock.live` | **Phase 2 VIP system** | The trigger for "email alerts for new drops" and "3–5 day early access" — this system already knows the instant a new product gets its first stock at any branch; Phase 2 just needs to subscribe to it |
| `alert.critical` | Push notification service / SMS gateway | Gets a critical low-stock or stuck-order alert to a phone even with the app closed |
| `sales_daily.rollup` | Future accounting tool (e.g. Xero/Sage) | Daily revenue-by-branch export, so bookkeeping doesn't need a separate manual pull |

## Auth

- Staff log in with **name + short PIN** on shared shop devices (fast, thumb-only —
  see [02-MOBILE-EXPERIENCE.md](02-MOBILE-EXPERIENCE.md)); the API issues a scoped,
  short-lived JWT carrying `role` and `branch_id`.
- Service-to-service calls (WooCommerce sync job, future POS) use a separate API
  key per integration, each scoped to only the resources it needs
  (e.g. the WooCommerce sync key can read/write `products`/`stock`/`orders` but
  never `staff` or `tasks`).

## Sync strategy with WooCommerce (once Phase 1 ships)

1. **Catalogue**: this system is the source of truth going forward. On day one,
   it **fetches** (`GET /products`) whatever's already live on the storefront to
   seed `product`/`product_variant` — no re-typing an existing catalogue by hand —
   then a scheduled job (or webhook on `product.updated`) pushes product/price/
   variant changes made here back out to WooCommerce from then on.
2. **Stock**: this system is the source of truth for on-hand stock; the
   `online_dc` branch's `qty_on_hand` (minus `qty_reserved`) is what WooCommerce
   shows as "in stock." Pushed on every `stock_level` change for that branch.
3. **Orders**: WooCommerce is the source of truth for a customer placing an
   order. This system fetches (`GET /orders`) existing order history on
   bootstrap, then relies on the `order.created` webhook for new ones in real
   time — with a periodic fetch-and-reconcile pass as the backstop for anything
   a dropped webhook would otherwise miss (see **Fetching data from
   WooCommerce** above).
4. **Customers/VIP**: WooCommerce (Phase 1 sign-up, Phase 2 VIP tagging) is the
   source of truth; this system fetches (`GET /customers`) to seed and
   periodically refresh its `customer`/`vip_status` read cache, used for showing
   order context here — never where VIP status is decided.

This keeps a clean separation: **WooCommerce owns the customer-facing shop,
this system owns operations** — each is the authority on its own half, connected
by webhooks for real-time events and direct API fetches for bootstrap and
reconciliation, instead of one trying to do the other's job.
