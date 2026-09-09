// Chiefs of Angels product catalogue — pulled from the live storefront
// (chiefsofangels.co.za: New In, Loungewear, Accessories), de-duplicated.
// See /PROJECTS/CHIEFS OF ANGELS INVENTORY/07-PRODUCT-CATALOG.md for provenance.

const APPAREL_SIZES = ['S', 'M', 'L', 'XL']
const DENIM_SIZES = ['26', '28', '30', '32', '34']
const ONE_SIZE = ['One Size']

// [sku, name, category, priceRand, sizes, salePriceRand?]
const RAW = [
  // Accessories — caps
  ['ACC-001', 'Cream White NY Cap', 'Accessories', 840, ONE_SIZE],
  ['ACC-002', 'Maroon Noah NY Cap', 'Accessories', 840, ONE_SIZE],
  ['ACC-003', 'Black Noah NY Cap', 'Accessories', 840, ONE_SIZE],
  ['ACC-004', 'Black NY Cap', 'Accessories', 840, ONE_SIZE],
  ['ACC-005', 'Navy Blue Noah NY Cap', 'Accessories', 840, ONE_SIZE],
  ['ACC-006', 'Green Noah NY Cap', 'Accessories', 840, ONE_SIZE],
  ['ACC-007', 'Black LA Cap', 'Accessories', 840, ONE_SIZE],
  ['ACC-008', 'Sky Blue Noah NY Cap', 'Accessories', 840, ONE_SIZE],
  ['ACC-009', 'Red Noah NY Cap', 'Accessories', 840, ONE_SIZE],
  ['ACC-010', 'Pink Noah NY Cap', 'Accessories', 840, ONE_SIZE],

  // Loungewear
  ['LNG-001', 'Artwork Tee', 'Loungewear', 1250, APPAREL_SIZES],
  ['LNG-002', 'Midnight Vest', 'Loungewear', 950, APPAREL_SIZES],
  ['LNG-003', 'Bowie Tee', 'Loungewear', 1050, APPAREL_SIZES],
  ['LNG-004', 'Rock Stars Never Die Vest', 'Loungewear', 950, APPAREL_SIZES],
  ['LNG-005', 'Rock Stars Never Die Tee — Olive', 'Loungewear', 1050, APPAREL_SIZES],
  ['LNG-006', 'Rock Stars Never Die Tee — White', 'Loungewear', 1050, APPAREL_SIZES],
  ['LNG-007', 'Rock Stars Never Die Tee — Black', 'Loungewear', 1050, APPAREL_SIZES],
  ['LNG-008', 'Rock Stars Never Die Long Sleeve Tee', 'Loungewear', 1150, APPAREL_SIZES],
  ['LNG-009', 'Rock Stars Never Die Sweater', 'Loungewear', 1750, APPAREL_SIZES],
  ['LNG-010', 'Thunderstruck Tee', 'Loungewear', 1050, APPAREL_SIZES],
  ['LNG-011', 'Rolling Stones US Tour Tee', 'Loungewear', 1150, APPAREL_SIZES],
  ['LNG-012', 'Logo Fitted Tee', 'Loungewear', 950, APPAREL_SIZES],
  ['LNG-013', 'Logo Sweat Pants', 'Loungewear', 1350, APPAREL_SIZES, 945],
  ['LNG-014', 'Heart Joggers', 'Loungewear', 1450, APPAREL_SIZES],
  ['LNG-015', 'Heart Studded Sweater', 'Loungewear', 1850, APPAREL_SIZES],
  ['LNG-016', 'Art Department Sweater', 'Loungewear', 1650, APPAREL_SIZES],
  ['LNG-017', 'Midnight Sweater', 'Loungewear', 1850, APPAREL_SIZES],

  // Outerwear
  ['OUT-001', 'Rolling Stones Flannel', 'Outerwear', 2150, APPAREL_SIZES],
  ['OUT-002', 'Outlaw Sleeveless Leather Jacket', 'Outerwear', 3950, APPAREL_SIZES],
  ['OUT-003', 'The Nomad Jacket', 'Outerwear', 2950, APPAREL_SIZES],
  ['OUT-004', 'The Revival Jacket', 'Outerwear', 2950, APPAREL_SIZES],
  ['OUT-005', 'The Courtney Jacket', 'Outerwear', 2150, APPAREL_SIZES],
  ['OUT-006', 'The Hard Rock Denim Shirt', 'Outerwear', 2750, APPAREL_SIZES],
  ['OUT-007', 'All Star Check Shirt', 'Outerwear', 2150, APPAREL_SIZES],
  ['OUT-008', 'Cuddle Black Bomber Jacket', 'Outerwear', 2950, APPAREL_SIZES],
  ['OUT-009', 'The Black Cuddle', 'Outerwear', 2350, APPAREL_SIZES],
  ['OUT-010', 'Core Joplin Jacket', 'Outerwear', 4250, APPAREL_SIZES],
  ['OUT-011', 'Aretha Leather Jacket', 'Outerwear', 4950, APPAREL_SIZES],
  ['OUT-012', 'The Dylan Waistcoat', 'Outerwear', 2450, APPAREL_SIZES],

  // Denim & Bottoms
  ['DEN-001', 'Midnight Denim Shorts', 'Denim & Bottoms', 1950, DENIM_SIZES],
  ['DEN-002', 'Babycat Shorts', 'Denim & Bottoms', 1950, DENIM_SIZES],
  ['DEN-003', 'Patchwork Denim Shorts', 'Denim & Bottoms', 1950, DENIM_SIZES],
  ['DEN-004', 'Victoria Denim Jeans', 'Denim & Bottoms', 2650, DENIM_SIZES],
  ['DEN-005', 'Art Department Denim', 'Denim & Bottoms', 1950, DENIM_SIZES],
  ['DEN-006', 'Studio Denim Jeans', 'Denim & Bottoms', 2150, DENIM_SIZES],

  // Skirts
  ['SKT-001', 'Tharpe Skirt', 'Skirts', 3650, DENIM_SIZES],
]

export const CATEGORIES = ['Accessories', 'Loungewear', 'Outerwear', 'Denim & Bottoms', 'Skirts']

export const CATALOG = RAW.map(([sku, name, category, price, sizes, salePrice]) => ({
  sku,
  name,
  category,
  priceCents: price * 100,
  salePriceCents: salePrice ? salePrice * 100 : null,
  variants: sizes.map((size) => ({
    variantSku: sizes.length === 1 && sizes[0] === 'One Size' ? sku : `${sku}-${size}`,
    size,
  })),
}))

export function formatZAR(cents) {
  return 'R' + (cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
