# Alerts & Smart Suggestions

The system's job is to notice things before a human has to go looking. Every rule
below writes an `alert` row (see [05-DATA-MODEL.md](05-DATA-MODEL.md)) that surfaces
on the relevant Home tab, badges the tab icon, and (later) sends a push
notification. Alerts are **role- and branch-scoped** — a Sales Associate never sees
another branch's alerts; the Ops Manager sees everything.

## Alert types

| Type | Severity | Trigger | Who sees it |
|---|---|---|---|
| **Low stock** 🔴 | Critical | `qty_on_hand ≤ reorder_point` for a variant at a branch | That branch's manager + Ops Manager |
| **Out of stock** 🔴 | Critical | `qty_on_hand = 0` and the item sold in the last 14 days | That branch's manager + Ops Manager |
| **Overstock** 🟡 | Info | `qty_on_hand ≥ par_level × 2` **and** no sale in 14 days | That branch's manager + Ops Manager |
| **Transfer suggestion** 🟡 | Suggestion | See algorithm below | Ops Manager (accept/dismiss), sending & receiving branch managers (visibility) |
| **High-demand spike** 🟠 | Warning | 7-day sell-through velocity for a variant at a branch jumps ≥ 75% vs its trailing 4-week average, **and** days-of-cover < 5 | That branch's manager + Ops Manager |
| **Task overdue** 🟠 | Warning | A task's due date/time passes with status ≠ Done | The assignee + their Branch Manager |
| **Order stuck** 🟠 | Warning | An order stays in the same status past its SLA (e.g. "New" > 4 hrs, "Packed" > 24 hrs unpicked up) | Assigned branch + Ops Manager |
| **New drop live** ℹ️ *(Phase 2 hook)* | Info | A product's first branch receives its first stock | VIP customers (once Phase 2 ships) — see integrations doc |

## Transfer suggestion algorithm

Run continuously (or on a schedule, e.g. every few hours) per product variant,
across all branches:

1. For every branch, compute **surplus/deficit**:
   `imbalance = qty_on_hand − reorder_point` (negative = needs stock, positive =
   has spare above its own safety line).
2. Compute **sell-through velocity** at each branch (units/day, trailing 14 days).
3. Rank branches with `imbalance < 0` (needy) by *how soon they'll hit zero*:
   `days_of_cover = qty_on_hand ÷ velocity` (a branch selling fast and low is more
   urgent than one that's merely low).
4. For each needy branch, find the surplus branch with the **largest positive
   imbalance and the lowest velocity** for that same item (i.e. stock sitting still
   somewhere it isn't moving) — that's the best candidate to draw from, not just
   the nearest branch.
5. Suggested transfer qty = `min(surplus_branch.imbalance, needy_branch.reorder_point − needy_branch.qty_on_hand)`
   — never proposes draining a branch below its own safety stock.
6. Write a `transfer` row with status `Suggested`, both branches, the variant and
   qty, and a plain-language reason string (e.g. *"Durban is 3 days from selling
   out of the Bowie Tee (M); Sandton has 9 sitting with no sale in 18 days."*) so
   the Ops Manager isn't just shown a number, they're shown the case for it.
7. If ignored for 48 hours, the suggestion's severity escalates (🟡 → 🟠) rather
   than silently expiring.

## Sell-through & reorder point (baseline formulas, tunable per product later)

- `reorder_point = average_daily_sales × lead_time_days × safety_factor`
  (safety_factor starts at 1.5, adjustable per category — accessories restock
  faster than leather jackets).
- `par_level = reorder_point × 2` — the "comfortable" shelf target used for
  overstock detection.
- `days_of_cover = qty_on_hand ÷ average_daily_sales` — the single number shown
  most prominently on a low-stock alert, because "3 days left" is more actionable
  than "6 units left."

## Where alerts live in the UI

- **Home tab**, top of screen, grouped by severity — this is the first thing
  anyone sees on opening the app, per [00-DESIGN-PRINCIPLES.md](00-DESIGN-PRINCIPLES.md)'s
  "pushed, not browsed to" principle.
- **Tab badge** — a red dot with count on Home (and on Transfers, for pending
  suggestions specifically) whenever there's anything unread.
- **Insights → Alert history** (Ops Manager only) — full log, filterable, so
  patterns (a branch that's chronically understocked on one category, say) become
  visible over time, not just one alert at a time.
- Future: real push notifications (see [09-BUILD-ROADMAP.md](09-BUILD-ROADMAP.md))
  so a critical alert reaches someone even with the app closed.
