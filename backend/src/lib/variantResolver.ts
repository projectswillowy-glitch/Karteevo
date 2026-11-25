import { prisma } from './prisma.js';

/**
 * Resolves a variant ID from productId, size, and color if variantId is not explicitly provided.
 * Useful when guest cart or legacy items only hold productId + size + color.
 */
export const resolveVariantId = async (
  productId: string,
  size?: string,
  color?: string
): Promise<string> => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: {
        include: {
          options: {
            include: {
              attribute: true,
              attributeValue: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  if (!product.variants || product.variants.length === 0) {
    throw new Error('Product has no variants');
  }

  // 1. Exact match on both size & color
  const exactMatch = product.variants.find((v) => {
    const hasSize = size
      ? v.options.some(
          (opt) =>
            opt.attribute.name.toLowerCase() === 'size' &&
            opt.attributeValue.value.toLowerCase() === size.toLowerCase()
        )
      : true;
    const hasColor = color
      ? v.options.some(
          (opt) =>
            opt.attribute.name.toLowerCase() === 'color' &&
            opt.attributeValue.value.toLowerCase() === color.toLowerCase()
        )
      : true;
    return hasSize && hasColor;
  });

  if (exactMatch) return exactMatch.id;

  // 2. Partial match on color or size
  const partialMatch = product.variants.find((v) => {
    const hasSize = size
      ? v.options.some(
          (opt) =>
            opt.attribute.name.toLowerCase() === 'size' &&
            opt.attributeValue.value.toLowerCase() === size.toLowerCase()
        )
      : false;
    const hasColor = color
      ? v.options.some(
          (opt) =>
            opt.attribute.name.toLowerCase() === 'color' &&
            opt.attributeValue.value.toLowerCase() === color.toLowerCase()
        )
      : false;
    return hasSize || hasColor;
  });

  if (partialMatch) return partialMatch.id;

  // 3. Fallback to first variant
  return product.variants[0].id;
};
