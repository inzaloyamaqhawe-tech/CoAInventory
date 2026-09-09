# Build Roadmap

## Recommended tech stack

| Layer | Choice | Why |
|---|---|---|
| Client | **Mobile-first, fully responsive Progressive Web App** (installable, works in a phone/tablet/PC browser alike, one codebase) | No app-store approval delay to iterate; installs to a phone's home screen and works offline, while the same build gives the Ops Manager a genuinely clear layout on a back-office or home PC (see [02-MOBILE-EXPERIENCE.md](02-MOBILE-EXPERIENCE.md)'s breakpoint table) — not a second desktop app. A native wrapper (Capacitor) can follow later for camera/barcode APIs without a rewrite if the PWA APIs prove limiting. |
| Frontend framework | React + a mobile component set, or Vue — either is fine; the important constraint is the IA in [02-MOBILE-EXPERIENCE.md](02-MOBILE-EXPERIENCE.md), not the framework | |
| Backend | REST API (Node/Express or Python/FastAPI) implementing [06-API-AND-INTEGRATIONS.md](06-API-AND-INTEGRATIONS.md) | Small team, fast to build, easy to host alongside the existing Render-based projects |
| Database | **PostgreSQL** | Matches the relational schema in [05-DATA-MODEL.md](05-DATA-MODEL.md) directly; strong support for the reporting queries the leaderboard/insights views need |
| Hosting | Render (Web Service + Postgres) — consistent with how the rest of the Chiefs of Angels / Bolide projects are already deployed | |
| Auth | JWT, short PIN login on shop devices per [06-API-AND-INTEGRATIONS.md](06-API-AND-INTEGRATIONS.md) | |
| Push notifications | Web Push (PWA-native) initially; SMS gateway fallback for critical alerts | |
| Barcode scanning | Device camera via browser `BarcodeDetector` API / a JS scanning library | No extra hardware required |

## Delivery milestones

### Milestone 1 — Foundations (data + catalogue)
- Stand up Postgres with the schema in [05-DATA-MODEL.md](05-DATA-MODEL.md).
- Build the REST API's read/write basics for `branches`, `staff`, `products`,
  `variants`, `stock_levels`.
- Load [07-PRODUCT-CATALOG.md](07-PRODUCT-CATALOG.md) and
  [08-SEED-DATA.md](08-SEED-DATA.md).
- PIN-based login, role/branch scoping enforced server-side.

### Milestone 2 — Phase 3: Stock & Stockies
- Mobile UI: Home, Stock ("Stockies") tab, product card with per-branch bars.
- Stock count/adjust flow (stepper UI), `stock_movement` logging.
- Transfer workflow UI + API (`Suggested → Requested → Approved → In Transit →
  Received`).
- Transfer suggestion engine (scheduled job implementing the algorithm in
  [04-ALERTS-AND-INTELLIGENCE.md](04-ALERTS-AND-INTELLIGENCE.md)).
- Low-stock / overstock / out-of-stock alerts live on Home.

### Milestone 3 — Phase 4: Admin & Employee Dashboard
- Task creation/assignment UI (Ops Manager + Branch Manager), staff task view.
- Order tracking UI + manual in-store order entry.
- Branch leaderboard / Insights tab.
- Task-overdue and order-stuck alerts.
- Full role-based nav split (Sales Associate / Branch Manager / Ops Manager
  builds, per [02-MOBILE-EXPERIENCE.md](02-MOBILE-EXPERIENCE.md)).

### Milestone 4 — Integrations
- WooCommerce sync job (products, stock, orders) once Phase 1 site work ships —
  see [06-API-AND-INTEGRATIONS.md](06-API-AND-INTEGRATIONS.md).
- `new_stock.live` webhook wired, ready for Phase 2 VIP system to subscribe to.
- Push notifications for critical alerts.

### Milestone 5 — Polish & scale
- Offline queueing for stock counts/task completion in dead zones.
- Barcode scan-to-find and scan-to-receive.
- Audit log views, alert history/filtering in Insights.
- Performance pass on the leaderboard/insights queries as branch count grows.

## Dependencies on the wider project plan

- Milestone 4's WooCommerce sync depends on **Phase 1** shipping (site fix +
  client sign-up) — this system's own build (Milestones 1–3) does **not** block on
  that and can start immediately in parallel.
- The `new_stock.live` webhook is ready before **Phase 2** needs it — no rework
  required when VIP client system development begins.
- **Phase 5** (design/marketing) consumes this system's leaderboard/sell-through
  data informally (what's worth promoting) but has no technical dependency.
