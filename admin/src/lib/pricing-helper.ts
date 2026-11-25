export type TaxType = "exclusive" | "inclusive";

export function roundToTwo(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/** purchase_inc = purchase_exc * (1 + tax_rate/100) */
export function calculatePurchaseInc(
  purchaseExc: number,
  taxRate = 0
): number {
  const safeExc = Math.max(0, Number(purchaseExc) || 0);
  const safeRate = Math.max(0, Number(taxRate) || 0);
  return safeExc * (1 + safeRate / 100);
}

/** purchase_exc = purchase_inc / (1 + tax_rate/100) */
export function calculatePurchaseExc(
  purchaseInc: number,
  taxRate = 0
): number {
  const safeInc = Math.max(0, Number(purchaseInc) || 0);
  const safeRate = Math.max(0, Number(taxRate) || 0);
  const r = safeRate / 100;
  return r === 0 ? safeInc : safeInc / (1 + r);
}

/** selling_exc = purchase_exc * (1 + margin/100) */
export function calculateSellingExcFromMargin(
  purchaseExc: number,
  margin = 0
): number {
  const safeExc = Math.max(0, Number(purchaseExc) || 0);
  const safeMargin = Math.max(0, Number(margin) || 0);
  return safeExc * (1 + safeMargin / 100);
}

/** margin = (selling_exc - purchase_exc) / purchase_exc * 100 */
export function calculateMarginFromSellingExc(
  purchaseExc: number,
  sellingExc: number
): number {
  const safeExc = Math.max(0, Number(purchaseExc) || 0);
  const safeSelling = Math.max(0, Number(sellingExc) || 0);
  if (safeExc <= 0) return 0;
  const rawMargin = ((safeSelling - safeExc) / safeExc) * 100;
  if (!Number.isFinite(rawMargin) || Number.isNaN(rawMargin) || rawMargin < 0)
    return 0;
  return Math.min(999999.99, rawMargin);
}

/** selling_inc = selling_exc * (1 + tax_rate/100) */
export function calculateSellingInc(sellingExc: number, taxRate = 0): number {
  const safeExc = Math.max(0, Number(sellingExc) || 0);
  const safeRate = Math.max(0, Number(taxRate) || 0);
  return safeExc * (1 + safeRate / 100);
}

/** selling_exc = selling_inc / (1 + tax_rate/100) */
export function calculateSellingExcFromInc(
  sellingInc: number,
  taxRate = 0
): number {
  const safeInc = Math.max(0, Number(sellingInc) || 0);
  const safeRate = Math.max(0, Number(taxRate) || 0);
  const r = safeRate / 100;
  return r === 0 ? safeInc : safeInc / (1 + r);
}
