"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Camera, Info, Plus, Tag, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useConfigurableProduct,
  type VariantData,
} from "@/context/ConfigurableProductContext";
import { apiFetch } from "@/lib/api-client";
import {
  calculateMarginFromSellingExc,
  calculatePurchaseExc,
  calculatePurchaseInc,
  calculateSellingExcFromInc,
  calculateSellingExcFromMargin,
  calculateSellingInc,
  roundToTwo,
  type TaxType,
} from "@/lib/pricing-helper";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type ProductType = "single" | "variable";
type SkuFormat = "sku-number" | "sku-variation";

interface DbAttributeValue {
  id: string;
  value: string;
}

interface DbAttribute {
  id: string;
  name: string;
  values: DbAttributeValue[];
}

interface VariationRowItem {
  id: string;
  sku: string;
  valueId: string;
  valueName: string;
  purchasePrice: number; // Exc. tax
  purchasePriceInc: number; // Inc. tax
  margin: number;
  sellingPrice: number; // Exc. tax
  sellingPriceInc: number; // Inc. tax
  stock: number;
  image: File | null;
}

interface VariationGroup {
  id: string;
  variationId: string;
  variationName: string;
  rows: VariationRowItem[];
}

/* ------------------------------------------------------------------ */
/* SKU helpers                                                         */
/* ------------------------------------------------------------------ */
function generateBaseSku(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

function buildVariationCode(valName?: string): string {
  if (!valName) return "";
  const upper = valName.trim().toUpperCase();

  const colorMap: Record<string, string> = {
    BLACK: "BLK",
    BLUE: "BLU",
    BROWN: "BRN",
    GREY: "GRY",
    GRAY: "GRY",
    GOLD: "GLD",
    RED: "RED",
    WHITE: "WHT",
    ROSEWOOD: "RSW",
    "NUDE BEIGE": "NDE",
    PINK: "PNK",
    GREEN: "GRN",
    YELLOW: "YLW",
    SMALL: "S",
    MEDIUM: "M",
    LARGE: "L",
    "EXTRA LARGE": "XL",
  };
  if (colorMap[upper]) return colorMap[upper];

  const clean = upper.replace(/[^A-Z0-9]/g, "");
  return clean.length <= 4 ? clean : clean.substring(0, 4);
}

function buildSku(
  format: SkuFormat,
  prefix: string,
  index: number,
  valName?: string
): string {
  if (format === "sku-variation") {
    const code = buildVariationCode(valName);
    return code ? `${prefix}${code}` : `${prefix}V${index + 1}`;
  }
  return `${prefix}-${index + 1}`;
}

function newRow(
  format: SkuFormat,
  prefix: string,
  index: number,
  valueId = "",
  valueName = ""
): VariationRowItem {
  return {
    id: `temp_row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sku: buildSku(format, prefix, index, valueName),
    valueId,
    valueName,
    purchasePrice: 0,
    purchasePriceInc: 0,
    margin: 25,
    sellingPrice: 0,
    sellingPriceInc: 0,
    stock: 10,
    image: null,
  };
}

/* Two rows can resolve to the same code (e.g. "Black" picked twice), so keep
   generated SKUs unique within the product before they reach the API. */
function withUniqueSkus(list: VariationGroup[]): VariationGroup[] {
  const seen = new Set<string>();
  return list.map((g) => ({
    ...g,
    rows: g.rows.map((r) => {
      if (!r.sku) return r;
      let sku = r.sku;
      let n = 2;
      while (seen.has(sku)) sku = `${r.sku}-${n++}`;
      seen.add(sku);
      return sku === r.sku ? r : { ...r, sku };
    }),
  }));
}

/* Running row offset so SKUs stay unique across attribute groups */
function skuOffsetFor(list: VariationGroup[], groupId?: string): number {
  if (!groupId) return list.reduce((n, g) => n + g.rows.length, 0);
  let offset = 0;
  for (const g of list) {
    if (g.id === groupId) break;
    offset += g.rows.length;
  }
  return offset;
}

/* ------------------------------------------------------------------ */
/* Camera Image Upload                                                  */
/* ------------------------------------------------------------------ */
function ImageCameraUpload({
  value,
  onChange,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div className="relative inline-flex items-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative size-8 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden group cursor-pointer shadow-2xs">
          <Image
            src={preview}
            alt="variant"
            fill
            className="object-cover"
            unoptimized
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="absolute inset-0 bg-black/70 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition-opacity cursor-pointer"
            title="Remove Image"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="size-8 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 flex items-center justify-center transition-colors cursor-pointer"
          title="Upload Variant Image"
        >
          <Camera className="size-4" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */
export default function ProductVariationsSection() {
  const { updateBaseProduct, setVariants } = useConfigurableProduct();

  /* Controls */
  const [taxRate, setTaxRate] = useState<number>(0);
  const [taxType, setTaxType] = useState<TaxType>("exclusive");
  const [productType, setProductType] = useState<ProductType>("single");
  const [skuFormat, setSkuFormat] = useState<SkuFormat>("sku-number");
  // Generated after mount: a random value during SSR cannot match the client.
  const [baseSkuPrefix, setBaseSkuPrefix] = useState<string>("");

  /* Variation library (attributes + values from the database) */
  const [allAttrs, setAllAttrs] = useState<DbAttribute[]>([]);

  /* Single Product State */
  const [singleSku, setSingleSku] = useState<string>("");
  const [singlePurchasePrice, setSinglePurchasePrice] = useState<number>(0);
  const [singlePurchasePriceInc, setSinglePurchasePriceInc] = useState<number>(0);
  const [singleMargin, setSingleMargin] = useState<number>(25);
  const [singleSellingPrice, setSingleSellingPrice] = useState<number>(0);
  const [singleSellingPriceInc, setSingleSellingPriceInc] = useState<number>(0);
  const [singleStock, setSingleStock] = useState<number>(10);

  /* Variable Groups State */
  const [groups, setGroups] = useState<VariationGroup[]>([]);

  useEffect(() => {
    const prefix = generateBaseSku();
    setBaseSkuPrefix(prefix);
    setSingleSku(`${prefix}-1`);
  }, []);

  /* Load variation library from the backend */
  const refreshVariations = useCallback(async () => {
    try {
      const response = await apiFetch("/attributes", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setAllAttrs(data);
      }
    } catch (error) {
      console.error("Failed to fetch attributes:", error);
    }
  }, []);

  useEffect(() => {
    refreshVariations();
  }, [refreshVariations]);

  /* SKU Format Switch */
  const handleSkuFormatChange = (newFormat: SkuFormat) => {
    setSkuFormat(newFormat);
    setGroups((prev) => {
      let cursor = 0;
      return withUniqueSkus(
        prev.map((g) => ({
          ...g,
          rows: g.rows.map((r) => ({
            ...r,
            sku: buildSku(newFormat, baseSkuPrefix, cursor++, r.valueName),
          })),
        }))
      );
    });
  };

  /* Tax Rate change -> recalculate Inc. taxes */
  const handleTaxRateChange = (newRate: number) => {
    setTaxRate(newRate);
    setSinglePurchasePriceInc(
      roundToTwo(calculatePurchaseInc(singlePurchasePrice, newRate))
    );
    setSingleSellingPriceInc(
      roundToTwo(calculateSellingInc(singleSellingPrice, newRate))
    );

    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        rows: g.rows.map((r) => ({
          ...r,
          purchasePriceInc: roundToTwo(
            calculatePurchaseInc(r.purchasePrice, newRate)
          ),
          sellingPriceInc: roundToTwo(
            calculateSellingInc(r.sellingPrice, newRate)
          ),
        })),
      }))
    );
  };

  /* Single Product pricing handlers */
  const handleSinglePurchaseExcChange = (val: number) => {
    const purchaseExc = Math.max(0, val);
    const purchaseInc = roundToTwo(
      calculatePurchaseInc(purchaseExc, taxRate)
    );
    const sellingExc = roundToTwo(
      calculateSellingExcFromMargin(purchaseExc, singleMargin)
    );
    const sellingInc = roundToTwo(calculateSellingInc(sellingExc, taxRate));

    setSinglePurchasePrice(purchaseExc);
    setSinglePurchasePriceInc(purchaseInc);
    setSingleSellingPrice(sellingExc > 0 ? sellingExc : singleSellingPrice);
    setSingleSellingPriceInc(sellingInc > 0 ? sellingInc : singleSellingPriceInc);
  };

  const handleSinglePurchaseIncChange = (val: number) => {
    const purchaseInc = Math.max(0, val);
    const purchaseExc = roundToTwo(
      calculatePurchaseExc(purchaseInc, taxRate)
    );
    const sellingExc = roundToTwo(
      calculateSellingExcFromMargin(purchaseExc, singleMargin)
    );
    const sellingInc = roundToTwo(calculateSellingInc(sellingExc, taxRate));

    setSinglePurchasePrice(purchaseExc);
    setSinglePurchasePriceInc(purchaseInc);
    setSingleSellingPrice(sellingExc > 0 ? sellingExc : singleSellingPrice);
    setSingleSellingPriceInc(sellingInc > 0 ? sellingInc : singleSellingPriceInc);
  };

  const handleSingleMarginChange = (val: number) => {
    const margin = Math.max(0, val);
    setSingleMargin(margin);
    if (singlePurchasePrice > 0) {
      const sellingExc = roundToTwo(
        calculateSellingExcFromMargin(singlePurchasePrice, margin)
      );
      setSingleSellingPrice(sellingExc);
      setSingleSellingPriceInc(
        roundToTwo(calculateSellingInc(sellingExc, taxRate))
      );
    }
  };

  const handleSingleSellingChange = (val: number) => {
    const entered = Math.max(0, val);
    if (taxType === "exclusive") {
      const sellingExc = entered;
      setSingleSellingPrice(sellingExc);
      setSingleSellingPriceInc(
        roundToTwo(calculateSellingInc(sellingExc, taxRate))
      );
      if (singlePurchasePrice > 0) {
        setSingleMargin(
          roundToTwo(
            calculateMarginFromSellingExc(singlePurchasePrice, sellingExc)
          )
        );
      }
    } else {
      const sellingInc = entered;
      const sellingExc = roundToTwo(
        calculateSellingExcFromInc(sellingInc, taxRate)
      );
      setSingleSellingPrice(sellingExc);
      setSingleSellingPriceInc(sellingInc);
      if (singlePurchasePrice > 0) {
        setSingleMargin(
          roundToTwo(
            calculateMarginFromSellingExc(singlePurchasePrice, sellingExc)
          )
        );
      }
    }
  };

  /* Group & Row actions */
  const handleAddVariationGroup = () => {
    setGroups((prev) => [
      ...prev,
      {
        id: `vg-${Date.now()}`,
        variationId: "",
        variationName: "",
        rows: [newRow(skuFormat, baseSkuPrefix, skuOffsetFor(prev))],
      },
    ]);
  };

  const handleRemoveGroup = (groupId: string) =>
    setGroups((prev) => prev.filter((g) => g.id !== groupId));

  const handleSelectVariation = (groupId: string, attrId: string) => {
    const attr = allAttrs.find((a) => a.id === attrId);
    setGroups((prev) => {
      const offset = skuOffsetFor(prev, groupId);
      return withUniqueSkus(
        prev.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            variationId: attrId,
            variationName: attr ? attr.name : "",
            rows: g.rows.map((row, idx) => ({
              ...row,
              valueId: "",
              valueName: "",
              sku: buildSku(skuFormat, baseSkuPrefix, offset + idx),
            })),
          };
        })
      );
    });
  };

  const handleAddRow = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const newIndex = skuOffsetFor(prev, groupId) + g.rows.length;
        const firstRow = g.rows[0];
        return {
          ...g,
          rows: [
            ...g.rows,
            {
              ...newRow(skuFormat, baseSkuPrefix, newIndex),
              purchasePrice: firstRow ? firstRow.purchasePrice : 0,
              purchasePriceInc: firstRow ? firstRow.purchasePriceInc : 0,
              margin: firstRow ? firstRow.margin : 25,
              sellingPrice: firstRow ? firstRow.sellingPrice : 0,
              sellingPriceInc: firstRow ? firstRow.sellingPriceInc : 0,
            },
          ],
        };
      })
    );
  };

  const handleRemoveRow = (groupId: string, rowId: string) =>
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId || g.rows.length <= 1) return g;
        return { ...g, rows: g.rows.filter((r) => r.id !== rowId) };
      })
    );

  const updateRow = (
    groupId: string,
    rowId: string,
    patch: Partial<VariationRowItem>
  ) =>
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          rows: g.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
        };
      })
    );

  const handleSelectValue = (
    groupId: string,
    rowId: string,
    valueId: string,
    groupVariationId: string
  ) => {
    const attr = allAttrs.find((a) => a.id === groupVariationId);
    const valObj = attr?.values.find((v) => v.id === valueId);
    const valueName = valObj ? valObj.value : "";

    setGroups((prev) => {
      // Row indexes are per group, so offset them to keep SKUs unique across
      // every variation group of the product.
      const offset = skuOffsetFor(prev, groupId);
      return withUniqueSkus(
        prev.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            rows: g.rows.map((r, idx) => {
              if (r.id !== rowId) return r;
              return {
                ...r,
                valueId,
                valueName,
                sku: buildSku(
                  skuFormat,
                  baseSkuPrefix,
                  offset + idx,
                  valueName
                ),
              };
            }),
          };
        })
      );
    });
  };

  /* Row pricing handlers */
  const handleRowPurchaseExcChange = (
    groupId: string,
    rowId: string,
    val: number,
    currMargin: number
  ) => {
    const purchaseExc = Math.max(0, val);
    const sellingExc = roundToTwo(
      calculateSellingExcFromMargin(purchaseExc, currMargin)
    );
    updateRow(groupId, rowId, {
      purchasePrice: purchaseExc,
      purchasePriceInc: roundToTwo(
        calculatePurchaseInc(purchaseExc, taxRate)
      ),
      sellingPrice: sellingExc,
      sellingPriceInc: roundToTwo(calculateSellingInc(sellingExc, taxRate)),
    });
  };

  const handleRowPurchaseIncChange = (
    groupId: string,
    rowId: string,
    val: number,
    currMargin: number
  ) => {
    const purchaseInc = Math.max(0, val);
    const purchaseExc = roundToTwo(
      calculatePurchaseExc(purchaseInc, taxRate)
    );
    const sellingExc = roundToTwo(
      calculateSellingExcFromMargin(purchaseExc, currMargin)
    );
    updateRow(groupId, rowId, {
      purchasePrice: purchaseExc,
      purchasePriceInc: purchaseInc,
      sellingPrice: sellingExc,
      sellingPriceInc: roundToTwo(calculateSellingInc(sellingExc, taxRate)),
    });
  };

  const handleRowMarginChange = (
    groupId: string,
    rowId: string,
    val: number,
    currPurchaseExc: number
  ) => {
    const margin = Math.max(0, val);
    const sellingExc =
      currPurchaseExc > 0
        ? roundToTwo(calculateSellingExcFromMargin(currPurchaseExc, margin))
        : 0;
    updateRow(groupId, rowId, {
      margin,
      sellingPrice: sellingExc,
      sellingPriceInc: roundToTwo(calculateSellingInc(sellingExc, taxRate)),
    });
  };

  const handleRowSellingChange = (
    groupId: string,
    rowId: string,
    val: number,
    currPurchaseExc: number
  ) => {
    const entered = Math.max(0, val);
    if (taxType === "exclusive") {
      const sellingExc = entered;
      updateRow(groupId, rowId, {
        sellingPrice: sellingExc,
        sellingPriceInc: roundToTwo(calculateSellingInc(sellingExc, taxRate)),
        margin:
          currPurchaseExc > 0
            ? roundToTwo(
                calculateMarginFromSellingExc(currPurchaseExc, sellingExc)
              )
            : 25,
      });
    } else {
      const sellingInc = entered;
      const sellingExc = roundToTwo(
        calculateSellingExcFromInc(sellingInc, taxRate)
      );
      updateRow(groupId, rowId, {
        sellingPrice: sellingExc,
        sellingPriceInc: sellingInc,
        margin:
          currPurchaseExc > 0
            ? roundToTwo(
                calculateMarginFromSellingExc(currPurchaseExc, sellingExc)
              )
            : 25,
      });
    }
  };

  /* Push pricing / variants into the product form context */
  useEffect(() => {
    if (productType === "single") {
      const effectiveSelling =
        taxType === "inclusive"
          ? singleSellingPriceInc > 0
            ? singleSellingPriceInc
            : 0
          : singleSellingPrice > 0
          ? singleSellingPrice
          : 0;

      setVariants([]);
      updateBaseProduct({
        basePrice: effectiveSelling,
        baseQuantity: singleStock,
        sku: singleSku,
        purchasePrice: singlePurchasePrice,
        purchasePriceInc: singlePurchasePriceInc,
        margin: singleMargin,
        sellingPriceInc: singleSellingPriceInc,
        taxRate,
        taxType,
        skuFormat,
        productType: "single",
      });
      return;
    }

    const built: VariantData[] = [];

    groups.forEach((g) => {
      g.rows.forEach((r) => {
        if (!r.valueId) return;

        const effectiveSelling =
          taxType === "inclusive"
            ? r.sellingPriceInc > 0
              ? r.sellingPriceInc
              : r.sellingPrice
            : r.sellingPrice > 0
            ? r.sellingPrice
            : r.purchasePrice > 0
            ? r.purchasePrice
            : 0;

        built.push({
          id: `var-${g.id}-${r.id}`,
          sku: r.sku || undefined,
          price: effectiveSelling,
          qty: Number(r.stock) >= 0 ? Number(r.stock) : 0,
          purchasePrice: r.purchasePrice,
          purchasePriceInc: r.purchasePriceInc,
          margin: r.margin,
          sellingPriceInc: r.sellingPriceInc,
          images: r.image ? [r.image] : [],
          attributes: [
            {
              attributeId: g.variationId,
              valueId: r.valueId,
              attributeName: g.variationName,
              value: r.valueName,
            },
          ],
        });
      });
    });

    setVariants(built);

    if (built.length > 0) {
      const prices = built
        .map((v) => v.price ?? 0)
        .filter((price) => price > 0);
      const totalQty = built.reduce((sum, v) => sum + (v.qty || 0), 0);
      updateBaseProduct({
        basePrice: prices.length > 0 ? Math.min(...prices) : 0,
        baseQuantity: totalQty,
        taxRate,
        taxType,
        skuFormat,
        productType: "variable",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    productType,
    taxRate,
    taxType,
    skuFormat,
    singleSku,
    singlePurchasePrice,
    singlePurchasePriceInc,
    singleMargin,
    singleSellingPrice,
    singleSellingPriceInc,
    singleStock,
    groups,
  ]);

  return (
    <div className="space-y-6">
      {/* Top Tax & Product Type Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Applicable Tax with Custom % */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Applicable Tax:
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                value={
                  [0, 5, 12, 18, 28].includes(taxRate)
                    ? String(taxRate)
                    : "custom"
                }
                onValueChange={(val) => {
                  if (val !== "custom") handleTaxRateChange(Number(val));
                }}
              >
                <SelectTrigger className="w-full h-9 rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 text-xs text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-indigo-500">
                  <SelectValue placeholder="Select Tax" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1c]">
                  <SelectItem value="0" className="text-xs">
                    None (0%)
                  </SelectItem>
                  <SelectItem value="5" className="text-xs">
                    GST @ 5%
                  </SelectItem>
                  <SelectItem value="12" className="text-xs">
                    GST @ 12%
                  </SelectItem>
                  <SelectItem value="18" className="text-xs">
                    GST @ 18%
                  </SelectItem>
                  <SelectItem value="28" className="text-xs">
                    GST @ 28%
                  </SelectItem>
                  <SelectItem
                    value="custom"
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                  >
                    Custom %
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center w-20 h-9 px-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a]">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={(e) =>
                  handleTaxRateChange(
                    Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                  )
                }
                className="w-full text-xs text-right bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 font-medium"
              />
              <span className="text-xs text-muted-foreground ml-1 font-medium">
                %
              </span>
            </div>
          </div>
        </div>

        {/* Selling Price Tax Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Selling Price Tax Type: <span className="text-red-500">*</span>
          </label>
          <Select
            value={taxType}
            onValueChange={(val) => setTaxType(val as TaxType)}
          >
            <SelectTrigger className="w-full h-9 rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 text-xs text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-indigo-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1c]">
              <SelectItem value="exclusive" className="text-xs">
                Exclusive
              </SelectItem>
              <SelectItem value="inclusive" className="text-xs">
                Inclusive
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Product Type */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Product Type: <span className="text-red-500">*</span>
            <Info className="size-3.5 text-indigo-500" />
          </label>
          <Select
            value={productType}
            onValueChange={(val) => {
              const pt = val as ProductType;
              setProductType(pt);
              if (pt === "variable" && groups.length === 0) {
                handleAddVariationGroup();
              }
            }}
          >
            <SelectTrigger className="w-full h-9 rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 text-xs text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1c]">
              <SelectItem value="single" className="text-xs">
                Single
              </SelectItem>
              <SelectItem value="variable" className="text-xs">
                Variable
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Single Product Pricing & Inventory */}
      {productType === "single" && (
        <div className="p-4 sm:p-5 border border-gray-200/80 dark:border-white/10 rounded-2xl bg-white dark:bg-[#121212] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-indigo-500" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Single Product Pricing &amp; Inventory
              </h4>
            </div>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
              Active Single Mode
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Default Purchase Price (Exc. tax)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={singlePurchasePrice || ""}
                onChange={(e) =>
                  handleSinglePurchaseExcChange(parseFloat(e.target.value) || 0)
                }
                placeholder="Exc. tax"
                className="w-full h-9 px-3 border border-gray-200 dark:border-white/10 rounded-xl text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Default Purchase Price (Inc. tax)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={singlePurchasePriceInc || ""}
                onChange={(e) =>
                  handleSinglePurchaseIncChange(parseFloat(e.target.value) || 0)
                }
                placeholder="Inc. tax"
                className="w-full h-9 px-3 border border-gray-200 dark:border-white/10 rounded-xl text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                x Margin (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={singleMargin}
                onChange={(e) =>
                  handleSingleMarginChange(parseFloat(e.target.value) || 0)
                }
                className="w-full h-9 px-3 border border-gray-200 dark:border-white/10 rounded-xl text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Default Selling Price (
                {taxType === "inclusive" ? "Inc. tax" : "Exc. tax"}){" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  taxType === "inclusive"
                    ? singleSellingPriceInc || ""
                    : singleSellingPrice || ""
                }
                onChange={(e) =>
                  handleSingleSellingChange(parseFloat(e.target.value) || 0)
                }
                placeholder={taxType === "inclusive" ? "Inc. tax" : "Exc. tax"}
                className="w-full h-9 px-3 border border-gray-200 dark:border-white/10 rounded-xl text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Stock Quantity (Units)
              </label>
              <input
                type="number"
                min="0"
                value={singleStock}
                onChange={(e) =>
                  setSingleStock(parseInt(e.target.value, 10) || 0)
                }
                className="w-full h-9 px-3 border border-gray-200 dark:border-white/10 rounded-xl text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Product SKU
              </label>
              <input
                type="text"
                value={singleSku}
                onChange={(e) => setSingleSku(e.target.value)}
                className="w-full h-9 px-3 border border-gray-200 dark:border-white/10 rounded-xl text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-medium"
              />
            </div>
          </div>
        </div>
      )}

      {/* Variable Product Section */}
      {productType === "variable" && (
        <div className="space-y-4">
          {/* Variation SKU Format Selector */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-700 dark:text-gray-300">
            <span className="font-semibold flex items-center gap-1">
              Variation SKU Format
              <Info className="size-3.5 text-indigo-500" />
            </span>

            <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="radio"
                name="skuFormat"
                value="sku-number"
                checked={skuFormat === "sku-number"}
                onChange={() => handleSkuFormatChange("sku-number")}
                className="accent-indigo-600"
              />
              <span>SKU-Number (Example -&gt; ABC-1, ABC-2)</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="radio"
                name="skuFormat"
                value="sku-variation"
                checked={skuFormat === "sku-variation"}
                onChange={() => handleSkuFormatChange("sku-variation")}
                className="accent-indigo-600"
              />
              <span>SKUVariation (Example -&gt; ABCS, ABCM)</span>
            </label>
          </div>

          {/* Add Variation Action Button */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              Add Variation: <span className="text-red-500">*</span>
            </span>
            <button
              type="button"
              onClick={handleAddVariationGroup}
              className="size-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
              title="Add another Variation attribute"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {/* Variation Groups List */}
          {groups.length === 0 ? (
            <div className="p-8 border border-dashed border-gray-300 dark:border-white/10 rounded-2xl text-center space-y-3">
              <p className="text-xs text-muted-foreground">
                No variations added yet. Click &quot;Add Variation&quot; to
                begin.
              </p>
              <button
                type="button"
                onClick={handleAddVariationGroup}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" />
                Add Variation
              </button>
            </div>
          ) : (
            groups.map((group) => {
              const currentAttr = allAttrs.find(
                (a) => a.id === group.variationId
              );
              const attrValues = currentAttr?.values || [];

              return (
                <div
                  key={group.id}
                  className="border border-gray-200/80 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-[#121212] shadow-xs"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-200/80 dark:divide-white/10">
                    {/* Left Column: Variation selector */}
                    <div className="lg:col-span-3 p-3.5 bg-gray-50/50 dark:bg-white/[0.015] space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveGroup(group.id)}
                          className="size-8 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                          title="Remove Variation"
                        >
                          <Trash2 className="size-4" />
                        </button>

                        <div className="flex-1">
                          <Select
                            value={group.variationId || "__none__"}
                            onValueChange={(val) =>
                              handleSelectVariation(
                                group.id,
                                val === "__none__" ? "" : val
                              )
                            }
                          >
                            <SelectTrigger className="w-full h-8 rounded-lg border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2.5 text-xs text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 font-medium">
                              <SelectValue placeholder="Please Select" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1c] max-h-56">
                              <SelectItem
                                value="__none__"
                                className="text-xs text-muted-foreground"
                              >
                                Please Select
                              </SelectItem>
                              {allAttrs.map((attr) => (
                                <SelectItem
                                  key={attr.id}
                                  value={attr.id}
                                  className="text-xs"
                                >
                                  {attr.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                    </div>

                    {/* Right Column: values sub-table */}
                    <div className="lg:col-span-9 bg-white dark:bg-[#141414] overflow-x-auto">
                      <div className="bg-gray-50/80 dark:bg-white/[0.02] text-gray-600 dark:text-gray-400 font-semibold text-[11px] grid grid-cols-12 px-3 py-2 items-center gap-2 border-b border-gray-200/80 dark:border-white/10 min-w-[850px]">
                        <div className="col-span-2 flex items-center gap-1">
                          SKU
                          <span className="inline-flex items-center justify-center size-3 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-bold">
                            i
                          </span>
                        </div>
                        <div className="col-span-2">Value</div>

                        <div className="col-span-3">
                          <div>Default Purchase Price</div>
                          <div className="grid grid-cols-2 gap-1 text-[10px] font-normal text-muted-foreground mt-0.5">
                            <span>Exc. tax</span>
                            <span>Inc. tax</span>
                          </div>
                        </div>

                        <div className="col-span-1">x Margin(%)</div>

                        <div className="col-span-2">
                          <div>Default Selling Price</div>
                          <div className="text-[10px] font-normal text-muted-foreground mt-0.5">
                            {taxType === "inclusive" ? "Inc. tax" : "Exc. tax"}
                          </div>
                        </div>

                        <div className="col-span-1">Stock</div>

                        <div className="col-span-1 text-center font-semibold">
                          Action
                        </div>
                      </div>

                      <div className="min-w-[850px] divide-y divide-gray-100 dark:divide-white/5">
                        {group.rows.map((row, rIdx) => (
                          <div
                            key={row.id}
                            className="grid grid-cols-12 px-3 py-2 gap-2 items-center hover:bg-gray-50/60 dark:hover:bg-white/[0.015] transition-colors"
                          >
                            {/* SKU */}
                            <div className="col-span-2">
                              <input
                                type="text"
                                value={row.sku}
                                onChange={(e) =>
                                  updateRow(group.id, row.id, {
                                    sku: e.target.value,
                                  })
                                }
                                className="w-full h-8 px-2.5 border border-gray-200 dark:border-white/10 rounded-lg text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-medium"
                                placeholder="SKU"
                              />
                            </div>

                            {/* Value */}
                            <div className="col-span-2">
                              <Select
                                value={row.valueId || "__none__"}
                                onValueChange={(val) =>
                                  handleSelectValue(
                                    group.id,
                                    row.id,
                                    val === "__none__" ? "" : val,
                                    group.variationId
                                  )
                                }
                              >
                                <SelectTrigger className="w-full h-8 rounded-lg border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2 text-xs text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 font-medium">
                                  <SelectValue placeholder="Enter value" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1c] max-h-56">
                                  <SelectItem
                                    value="__none__"
                                    className="text-xs text-muted-foreground"
                                  >
                                    Enter value
                                  </SelectItem>
                                  {attrValues.map((v) => (
                                    <SelectItem
                                      key={v.id}
                                      value={v.id}
                                      className="text-xs"
                                    >
                                      {v.value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Purchase price exc / inc */}
                            <div className="col-span-3 grid grid-cols-2 gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.purchasePrice || ""}
                                onChange={(e) =>
                                  handleRowPurchaseExcChange(
                                    group.id,
                                    row.id,
                                    parseFloat(e.target.value) || 0,
                                    row.margin
                                  )
                                }
                                placeholder="Exc. tax"
                                className="w-full h-8 px-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.purchasePriceInc || ""}
                                onChange={(e) =>
                                  handleRowPurchaseIncChange(
                                    group.id,
                                    row.id,
                                    parseFloat(e.target.value) || 0,
                                    row.margin
                                  )
                                }
                                placeholder="Inc. tax"
                                className="w-full h-8 px-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                              />
                            </div>

                            {/* Margin */}
                            <div className="col-span-1">
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={row.margin}
                                onChange={(e) =>
                                  handleRowMarginChange(
                                    group.id,
                                    row.id,
                                    parseFloat(e.target.value) || 0,
                                    row.purchasePrice
                                  )
                                }
                                className="w-full h-8 px-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                              />
                            </div>

                            {/* Selling price */}
                            <div className="col-span-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  taxType === "inclusive"
                                    ? row.sellingPriceInc || ""
                                    : row.sellingPrice || ""
                                }
                                onChange={(e) =>
                                  handleRowSellingChange(
                                    group.id,
                                    row.id,
                                    parseFloat(e.target.value) || 0,
                                    row.purchasePrice
                                  )
                                }
                                placeholder={
                                  taxType === "inclusive"
                                    ? "Inc. tax"
                                    : "Exc. tax"
                                }
                                className="w-full h-8 px-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                              />
                            </div>

                            {/* Stock */}
                            <div className="col-span-1">
                              <input
                                type="number"
                                min="0"
                                value={row.stock}
                                onChange={(e) =>
                                  updateRow(group.id, row.id, {
                                    stock: parseInt(e.target.value, 10) || 0,
                                  })
                                }
                                className="w-full h-8 px-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                              />
                            </div>

                            {/* Image + actions */}
                            <div className="col-span-1 flex items-center justify-center gap-1.5">
                              <ImageCameraUpload
                                value={row.image}
                                onChange={(file) =>
                                  updateRow(group.id, row.id, { image: file })
                                }
                              />
                              {group.rows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveRow(group.id, row.id)
                                  }
                                  className="size-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Delete Row"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                              {rIdx === group.rows.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleAddRow(group.id)}
                                  className="size-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                                  title="Add new value row"
                                >
                                  <Plus className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
