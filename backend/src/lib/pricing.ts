export const FREE_SHIPPING_THRESHOLD = 1999;
export const STANDARD_SHIPPING_COST = 99;
export const EXPRESS_SHIPPING_COST = 199;

export type ShippingMethod = "standard" | "express";

/**
 * Shipping is only charged when the client explicitly selects a method.
 * Callers that omit it (e.g. the cart drawer checkout) keep the legacy
 * behaviour of a shipping-free total.
 */
export function calculateShippingAmount(
  subtotal: number,
  method?: string | null
): number {
  if (method !== "standard" && method !== "express") return 0;
  if (method === "express") return EXPRESS_SHIPPING_COST;
  return subtotal > FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_COST;
}
