# Product Catalogue

Pulled from the live storefront (chiefsofangels.co.za — New In, Loungewear,
Accessories) and de-duplicated to **46 unique products**. This is the starting
catalogue to load into `product`/`product_variant` (see
[05-DATA-MODEL.md](05-DATA-MODEL.md)).

## SKU scheme

`[CATEGORY]-[SEQ]` for the product, `[CATEGORY]-[SEQ]-[VARIANT]` for a variant —
e.g. `ACC-004-BLK` for the Black NY Cap.

| Category | Prefix |
|---|---|
| Loungewear | `LNG` |
| Outerwear | `OUT` |
| Denim & Bottoms | `DEN` |
| Accessories | `ACC` |
| Skirts | `SKT` |

## Accessories — Caps (`ACC`) — R840 each

| SKU | Product | Price |
|---|---|---|
| ACC-001 | Cream White NY Cap | R840 |
| ACC-002 | Maroon Noah NY Cap | R840 |
| ACC-003 | Black Noah NY Cap | R840 |
| ACC-004 | Black NY Cap | R840 |
| ACC-005 | Navy Blue Noah NY Cap | R840 |
| ACC-006 | Green Noah NY Cap | R840 |
| ACC-007 | Black LA Cap | R840 |
| ACC-008 | Sky Blue Noah NY Cap | R840 |
| ACC-009 | Red Noah NY Cap | R840 |
| ACC-010 | Pink Noah NY Cap | R840 |

*Same silhouette, ten colourways — a single `Cap` product line would arguably be
one `product` with 10 variants; kept as 10 separate SKUs above to match exactly how
the storefront currently lists them. Worth revisiting as a variant consolidation
once the catalogue moves into this system (see* [09-BUILD-ROADMAP.md](09-BUILD-ROADMAP.md)*).*

## Loungewear (`LNG`)

| SKU | Product | Price |
|---|---|---|
| LNG-001 | Artwork Tee | R1,250 |
| LNG-002 | Midnight Vest | R950 |
| LNG-003 | Bowie Tee | R1,050 |
| LNG-004 | Rock Stars Never Die Vest | R950 |
| LNG-005 | Rock Stars Never Die Tee — Olive | R1,050 |
| LNG-006 | Rock Stars Never Die Tee — White | R1,050 |
| LNG-007 | Rock Stars Never Die Tee — Black | R1,050 |
| LNG-008 | Rock Stars Never Die Long Sleeve Tee | R1,150 |
| LNG-009 | Rock Stars Never Die Sweater | R1,750 |
| LNG-010 | Thunderstruck Tee | R1,050 |
| LNG-011 | Rolling Stones US Tour Tee | R1,150 |
| LNG-012 | Logo Fitted Tee | R665 – R950 |
| LNG-013 | Logo Sweat Pants | ~~R1,350~~ **R945** *(on sale)* |
| LNG-014 | Heart Joggers | R1,450 |
| LNG-015 | Heart Studded Sweater | R1,850 |
| LNG-016 | Art Department Sweater | R1,650 |
| LNG-017 | Midnight Sweater | R1,850 |

## Outerwear (`OUT`)

| SKU | Product | Price |
|---|---|---|
| OUT-001 | Rolling Stones Flannel | R2,150 |
| OUT-002 | Outlaw Sleeveless Leather Jacket | R3,950 |
| OUT-003 | The Nomad Jacket | R2,950 |
| OUT-004 | The Revival Jacket | R2,950 |
| OUT-005 | The Courtney Jacket | R2,150 |
| OUT-006 | The Hard Rock Denim Shirt | R2,750 |
| OUT-007 | All Star Check Shirt | R2,150 |
| OUT-008 | Cuddle Black Bomber Jacket | R2,950 |
| OUT-009 | The Black Cuddle | R2,350 |
| OUT-010 | Core Joplin Jacket | R4,250 |
| OUT-011 | Aretha Leather Jacket | R4,950 |
| OUT-012 | The Dylan Waistcoat | R2,450 |

## Denim & Bottoms (`DEN`)

| SKU | Product | Price |
|---|---|---|
| DEN-001 | Midnight Denim Shorts | R1,950 |
| DEN-002 | Babycat Shorts | R1,950 |
| DEN-003 | Patchwork Denim Shorts | R1,950 |
| DEN-004 | Victoria Denim Jeans | R2,650 |
| DEN-005 | Art Department Denim | R1,950 |
| DEN-006 | Studio Denim Jeans | R2,150 |

## Skirts (`SKT`)

| SKU | Product | Price |
|---|---|---|
| SKT-001 | Tharpe Skirt | R3,650 |

## Catalogue summary

| Category | Item count | Price range |
|---|---|---|
| Accessories (caps) | 10 | R840 flat |
| Loungewear | 17 | R665 – R1,850 |
| Outerwear | 12 | R2,150 – R4,950 |
| Denim & Bottoms | 6 | R1,950 – R2,650 |
| Skirts | 1 | R3,650 |
| **Total** | **46** | R665 – R4,950 |

## Variants (sizing)

Sizing wasn't visible on the storefront's list views. Recommended default variant
set to load per product at build time (editable per item once real sizing is
confirmed):

- **Tees, vests, sweaters, jackets, shirts** → S / M / L / XL
- **Caps** → One Size
- **Denim, shorts, skirts** → 26 / 28 / 30 / 32 / 34

This is the one place in the catalogue where the real spread should be confirmed
against actual stock before go-live — everything else above (names, prices,
categories) is taken directly from the live site.
