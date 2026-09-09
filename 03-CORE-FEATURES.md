# Core Features

## 1. Stock tracking, per branch

Every product variant (size/colour where applicable) carries a live quantity **per
branch**, not one company-wide number. Each branch does a **daily digital stock
capture** (per the project plan) instead of a photo/WhatsApp thread:

- Quick recount: open a product, adjust the stepper, save — logged as a
  `stock_movement` with who/when.
- Receiving stock (from a supplier or an incoming transfer) increments the count
  and is logged automatically when a transfer is marked "Received."
- A sale (from the online store via webhook, or logged manually for an in-store
  sale not yet POS-integrated) decrements the count automatically.
- Every change to a number is a row in `stock_movements` — nothing overwrites
  silently, so any count is fully explainable after the fact.

## 2. "Stockies" — cross-branch stock visibility

Named straight out of the project plan: the single screen that answers *"what does
every branch have of this?"* without a phone call.

- Product card shows a **horizontal stock bar per branch** — instant visual compare.
- Sales Associates see this too (read-only) so they can tell a customer "we don't
  have your size here, but Cape Town does" and trigger a transfer request or
  reserve-and-ship — this is the direct fix for the "photos and WhatsApp" problem
  named in the project plan.
- Warehouse/DC stock (see [08-SEED-DATA.md](08-SEED-DATA.md)) shows in the same
  view as just another "branch," so online-order fulfilment and in-store stock are
  one picture, not two systems.

## 3. Transfer tracking & suggestions

**State machine**: `Suggested → Requested → Approved → In Transit → Received`
(or `Cancelled` at any point before In Transit).

- **Suggested** — system-generated, nobody asked for it (see
  [04-ALERTS-AND-INTELLIGENCE.md](04-ALERTS-AND-INTELLIGENCE.md) for the logic).
  Shows up as a card the Ops Manager or a Branch Manager can accept (→ Requested)
  or dismiss.
- **Requested** — a human asked for stock to move (either from a suggestion, or a
  Branch Manager manually requesting from the Stockies view).
- **Approved** — the sending branch or the Ops Manager confirms the qty to send.
- **In Transit** — dispatched; sending branch's count is decremented immediately so
  it's never double-counted as available.
- **Received** — receiving branch confirms on arrival (ideally by scanning); their
  count increments and the loop closes.
- Every transfer keeps a **full item list and timeline** — what went where, when,
  and who actioned each step — the explicit "clear record" the project plan asks for.

## 4. Staff task tracking

- Tasks are created **daily, weekly, or tied to an event/campaign** (matches the
  project plan's "assign duties by period" exactly), by an Ops Manager or Branch
  Manager.
- Assigned to one staff member, one branch, or a role (e.g. "every Sales Associate
  at Cape Town").
- States: `Pending → In Progress → Done`, or `Overdue` (auto-flips past due date/time).
- Staff only ever see **their own** assigned tasks on Home/Tasks — the project
  plan's "each employee logs in to see only their own assigned responsibilities."
- Managers see completion roll-ups (e.g. "Cape Town: 8/10 tasks done today") without
  chasing anyone — the project plan's "monitor progress without chasing people down."
- Multiple tasks and orders progress **in parallel** across the team — nothing here
  is single-threaded or blocks another staff member's queue.

## 5. Order tracking

- Orders come from two sources: **online** (via the future storefront API/webhook —
  see [06-API-AND-INTEGRATIONS.md](06-API-AND-INTEGRATIONS.md)) and **in-store**
  (logged manually — layby, special request, click-and-collect).
- States: `New → Packed → Ready for Pickup/Dispatch → Fulfilled`, or `Cancelled`.
- Assigned to a branch and optionally a staff member; shows on that person's Tasks
  view alongside their other duties, not as a separate silo.
- Fulfilment delay past an SLA window raises an alert (see next doc).

## 6. Branch performance leaderboard

Directly answers *"which one sells most in which shop"*:

- Ranks branches by revenue or units, over today / this week / this month.
- Per branch, per category and per product — "Sandton's top mover this week is the
  Rock Stars Never Die Tee; Durban hasn't sold a Tharpe Skirt in 30 days."
- Feeds the transfer-suggestion engine directly: a branch that isn't selling
  something is a candidate to send it to one that is.
- Feeds staffing/restock decisions the Ops Manager makes outside the app too —
  this view is the evidence, not just a vanity chart.

## 7. Product catalogue management

- One shared catalogue across all branches (see
  [07-PRODUCT-CATALOG.md](07-PRODUCT-CATALOG.md)) — a product and its price is
  defined once, stock is what varies per branch.
- New products can be added centrally (by the Ops Manager) and immediately appear
  as a zero-stock line at every branch until counted/received in.
- Kept in sync with the WooCommerce storefront via API so the shop's product list
  and the inventory system's never drift apart (see integrations doc).
