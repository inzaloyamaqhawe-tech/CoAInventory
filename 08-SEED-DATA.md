# Seed Data

Starting data to load the system with at launch — real enough structure to make
every feature in [03-CORE-FEATURES.md](03-CORE-FEATURES.md) and
[04-ALERTS-AND-INTELLIGENCE.md](04-ALERTS-AND-INTELLIGENCE.md) work end-to-end from
day one. Branch names, staff and exact counts should be swapped for the real
roster before go-live; the structure (4 branches, one central stock controller,
managers + associates per branch) is the recommended starting shape for a business
at this stage of the rollout described in the project plan.

## Branches

| Code | Name | Type | City |
|---|---|---|---|
| SAN | Sandton City | Retail (flagship) | Johannesburg |
| CPT | V&A Waterfront | Retail | Cape Town |
| DBN | Gateway | Retail | Durban |
| WH | Online Fulfilment | Warehouse / online DC | Johannesburg |

Four branches from the start (rather than one) so "Stockies" and transfer
suggestions have something to work across immediately — per the project plan's
"a single shop today and every branch as Chiefs of Angels expands," this is sized
for the *expansion*, not just the current single store; branches can be reduced to
match exactly where the business is today with a one-line edit to this table.

## Staff

| Name | Role | Branch |
|---|---|---|
| Naledi Mokoena | Operations Manager | All branches |
| Tumi Radebe | Stock Controller | Online Fulfilment (central) |
| Kabelo Sithole | Branch Manager | Sandton City |
| Amahle Ndlovu | Sales Associate | Sandton City |
| Jordan Pillay | Sales Associate | Sandton City |
| Chloé van Wyk | Branch Manager | V&A Waterfront |
| Lwazi Dlamini | Sales Associate | V&A Waterfront |
| Megan Adams | Sales Associate | V&A Waterfront |
| Sipho Zulu | Branch Manager | Gateway |
| Precious Naidoo | Sales Associate | Gateway |
| Ryan Govender | Sales Associate | Gateway |

## Stock levels (illustrative snapshot, drives the examples below)

| Product | Sandton | Cape Town | Durban | Warehouse | Reorder pt |
|---|---|---|---|---|---|
| Bowie Tee (M) — LNG-003 | 9 (no sale in 18 days) | 2 | 1 | 15 | 3 |
| Black NY Cap — ACC-004 | 4 | 6 | 5 | 20 | 4 |
| Rock Stars Never Die Tee, Black (M) — LNG-007 | 3 | 11 | 2 | 18 | 4 |
| Rolling Stones Flannel — OUT-001 | 6 | 3 | 0 (sold last unit yesterday) | 5 | 2 |
| Aretha Leather Jacket — OUT-011 | 2 | 1 | 1 | 3 | 1 |
| Tharpe Skirt — SKT-001 | 3 | 0 | 2 | 4 | 1 |

This spread is deliberately uneven — it's what makes the alert and transfer-
suggestion examples below real rather than hypothetical.

## Example alerts this snapshot generates

- 🔴 **Out of stock** — Rolling Stones Flannel at Durban (0 on hand, sold in the
  last 14 days) → Sipho Zulu + Naledi Mokoena.
- 🟡 **Transfer suggestion** — *"Durban is out of the Rolling Stones Flannel;
  Sandton has 6 with steady stock and no urgency. Suggest sending 3 to Durban."*
  → shows on Naledi's Transfers tab as a Suggested card.
- 🟡 **Overstock** — Bowie Tee (M) at Sandton (9 on hand, no sale in 18 days,
  ≥ 2× reorder point) → paired automatically with the Cape Town/Durban low levels
  of the same item into a second transfer suggestion.
- 🟠 **High-demand spike** — Rock Stars Never Die Tee (Black, M) at Cape Town
  selling fast enough that, despite 11 in stock, days-of-cover is trending down —
  flagged early rather than waiting for it to hit the reorder point.

## Example tasks

| Task | Type | Branch | Assigned to | Due |
|---|---|---|---|---|
| Daily stock count — Accessories wall | Daily | Sandton City | Amahle Ndlovu | Today, 10:00 |
| Restock front window display | Daily | V&A Waterfront | Lwazi Dlamini | Today, 09:00 |
| Count Denim & Bottoms shelf | Weekly | Gateway | Precious Naidoo | This Friday |
| Set up Spring Drop launch display | Event | Sandton City | Kabelo Sithole | Launch day, 08:00 |
| Reconcile October stock take | Weekly | All branches | Branch Managers | Month-end |

## Example orders

| Order # | Source | Branch | Status | Customer |
|---|---|---|---|---|
| #1042 | In-store (click & collect) | Sandton City | Ready for pickup | Thandi M. |
| #1043 | Online | Online Fulfilment | Packed | Ref. #WOO-8821 |
| #1044 | In-store (layby) | Gateway | New | Sipho's customer |

## Loading this data

Intended to seed the `branch`, `staff`, `stock_level`, `task` and `order` tables
directly (see [05-DATA-MODEL.md](05-DATA-MODEL.md)) via the build's seed script —
see [09-BUILD-ROADMAP.md](09-BUILD-ROADMAP.md) for where that fits in the delivery
plan. Product/variant seed comes from
[07-PRODUCT-CATALOG.md](07-PRODUCT-CATALOG.md).
