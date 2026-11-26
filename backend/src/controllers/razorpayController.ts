import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { calculateCouponDiscount } from "./couponController.js";
import { calculateShippingAmount } from "../lib/pricing.js";
import { resolveVariantId } from "../lib/variantResolver.js";

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

// Razorpay rejects a single order above this value (in rupees).
const RAZORPAY_MAX_AMOUNT = 500000;
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

if (!razorpayKeyId || !razorpayKeySecret) {
  console.warn("⚠️ Razorpay environment variables are missing. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
}

class CheckoutError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getRazorpayInstance() {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new CheckoutError(
      503,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
      "Online payment is temporarily unavailable. Please choose Cash on Delivery."
    );
  }
  return new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret,
  });
}

function getGatewayErrorMessage(error: any) {
  return (
    error?.error?.description ||
    error?.description ||
    error?.message ||
    "Failed to create Razorpay order"
  );
}

function isGatewayAuthError(error: any) {
  const status = error?.statusCode || error?.status;
  const description = getGatewayErrorMessage(error);
  return status === 401 || /authentication failed|unauthori[sz]ed/i.test(description);
}

function isAmountTooLargeError(error: any) {
  return /maximum amount/i.test(getGatewayErrorMessage(error));
}

function itemLabel(item: any, productName?: string | null) {
  const name = productName || item?.title || item?.name;
  return typeof name === "string" && name.trim() ? `"${name.trim()}"` : "An item in your cart";
}

async function resolveItemVariant(item: any) {
  const rawVariantId = typeof item?.variantId === "string" ? item.variantId.trim() : "";
  const rawProductId = typeof item?.productId === "string" ? item.productId.trim() : "";

  const variantId = OBJECT_ID_PATTERN.test(rawVariantId) ? rawVariantId : undefined;
  const productId = OBJECT_ID_PATTERN.test(rawProductId) ? rawProductId : undefined;

  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { name: true } } },
    });

    if (variant) return variant;
  }

  // The variant may have been re-created (for example after a catalog re-import)
  // while the cart still holds the old id. Try the product + size/colour instead.
  if (productId) {
    try {
      const resolvedId = await resolveVariantId(productId, item?.size, item?.color);
      const variant = await prisma.productVariant.findUnique({
        where: { id: resolvedId },
        include: { product: { select: { name: true } } },
      });
      if (variant) return variant;
    } catch {
      // Fall through to the "no longer available" error below.
    }
  }

  throw new CheckoutError(
    400,
    "ITEM_UNAVAILABLE",
    `${itemLabel(item)} is no longer available. Please remove it from your cart and add it again.`
  );
}

async function calculateServerAmount(
  items: any[],
  couponCode?: string,
  shippingMethod?: string
) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutError(400, "EMPTY_CART", "Your cart is empty.");
  }

  let subtotal = 0;

  for (const item of items) {
    const quantity = Number(item?.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new CheckoutError(400, "INVALID_QUANTITY", "Each item needs a valid quantity.");
    }

    const variant = await resolveItemVariant(item);
    const label = itemLabel(item, variant.product?.name);

    if (variant.qty < quantity) {
      throw new CheckoutError(
        400,
        "INSUFFICIENT_STOCK",
        variant.qty > 0
          ? `Only ${variant.qty} left of ${label}. Please update your cart.`
          : `${label} is out of stock. Please remove it from your cart.`
      );
    }

    subtotal += variant.price * quantity;
  }

  let discountAmount = 0;
  let finalAmount = subtotal;

  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode },
    });

    if (!coupon) {
      throw new CheckoutError(400, "INVALID_COUPON", "This coupon code is no longer valid.");
    }

    discountAmount = calculateCouponDiscount(coupon, subtotal);
    finalAmount = subtotal - discountAmount;
  }

  const shippingAmount = calculateShippingAmount(subtotal, shippingMethod);
  finalAmount += shippingAmount;

  return {
    subtotal,
    discountAmount,
    shippingAmount,
    finalAmount,
  };
}

// POST /api/payments/razorpay/create-order
export const createRazorpayOrder = async (req: Request, res: Response) => {
  try {
    const { items, couponCode, shippingMethod } = req.body ?? {};

    const amountData = await calculateServerAmount(items, couponCode, shippingMethod);

    if (amountData.finalAmount <= 0) {
      throw new CheckoutError(400, "INVALID_AMOUNT", "This order has no payable amount.");
    }

    if (amountData.finalAmount > RAZORPAY_MAX_AMOUNT) {
      throw new CheckoutError(
        400,
        "AMOUNT_TOO_HIGH",
        `Orders above ₹${RAZORPAY_MAX_AMOUNT.toLocaleString("en-IN")} cannot be paid online. Please reduce the order value or choose Cash on Delivery.`
      );
    }

    const razorpay = getRazorpayInstance();
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amountData.finalAmount * 100), // amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: (req as any).user?.id || "guest",
        couponCode: couponCode || "",
      },
    });

    console.log("Razorpay order created:", {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyPrefix: razorpayKeyId?.slice(0, 8),
    });

    await prisma.paymentLog.create({
      data: {
        amount: amountData.finalAmount,
        currency: "INR",
        status: "CREATED",
        paymentMethod: "RAZORPAY",
        gatewayOrderId: razorpayOrder.id,
      },
    });

    return res.json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount, // paise, as Razorpay checkout expects
        currency: razorpayOrder.currency,
        keyId: razorpayKeyId,
        total: amountData.finalAmount,
        discountAmount: amountData.discountAmount,
        shippingAmount: amountData.shippingAmount,
      },
      // Legacy flat fields kept for older clients
      keyId: razorpayKeyId,
      order: razorpayOrder,
      amount: amountData.finalAmount,
      discountAmount: amountData.discountAmount,
    });
  } catch (error: any) {
    if (error instanceof CheckoutError) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }

    console.error("Create Razorpay order error:", {
      message: getGatewayErrorMessage(error),
      statusCode: error?.statusCode || error?.status,
      keyPrefix: razorpayKeyId?.slice(0, 8),
    });

    if (isGatewayAuthError(error)) {
      return res.status(502).json({
        success: false,
        code: "PAYMENT_GATEWAY_AUTH",
        error: "Online payment is temporarily unavailable. Please choose Cash on Delivery.",
      });
    }

    if (isAmountTooLargeError(error)) {
      return res.status(400).json({
        success: false,
        code: "AMOUNT_TOO_HIGH",
        error: `Orders above ₹${RAZORPAY_MAX_AMOUNT.toLocaleString("en-IN")} cannot be paid online. Please reduce the order value or choose Cash on Delivery.`,
      });
    }

    return res.status(502).json({
      success: false,
      code: "PAYMENT_GATEWAY_ERROR",
      error: "Unable to start the payment right now. Please try again or choose Cash on Delivery.",
    });
  }
};

// POST /api/payments/razorpay/verify
export const verifyRazorpayPayment = async (req: Request, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body ?? {};

    if (!razorpayKeySecret) {
      return res.status(503).json({
        success: false,
        code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
        error: "Online payment is temporarily unavailable. Please choose Cash on Delivery.",
      });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        code: "MISSING_PAYMENT_DETAILS",
        error: "Missing Razorpay payment details",
      });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await prisma.paymentLog.updateMany({
        where: { gatewayOrderId: razorpay_order_id },
        data: {
          status: "FAILED",
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
          errorMessage: "Invalid Razorpay signature",
        },
      });

      return res.status(400).json({
        success: false,
        code: "INVALID_SIGNATURE",
        error: "Invalid payment signature",
      });
    }

    const updateResult = await prisma.paymentLog.updateMany({
      where: {
        gatewayOrderId: razorpay_order_id,
        paymentMethod: "RAZORPAY",
      },
      data: {
        status: "SUCCESS",
        gatewayPaymentId: razorpay_payment_id,
        gatewaySignature: razorpay_signature,
      },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({
        success: false,
        code: "PAYMENT_LOG_NOT_FOUND",
        error: "Payment log not found for this Razorpay order",
      });
    }

    return res.json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (error: any) {
    console.error("Verify Razorpay payment error:", error?.message || error);
    return res.status(500).json({
      success: false,
      code: "PAYMENT_VERIFICATION_FAILED",
      error: "Payment verification failed. Please contact support if money was deducted.",
    });
  }
};
