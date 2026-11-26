'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Check,
  ShoppingBag,
  Heart,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Share2,
  Scale,
  AlertCircle,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { getApiUrl } from '@/lib/api';

interface VariantOptionInfo {
  attribute?: { id?: string; name?: string };
  attributeValue?: { id?: string; value?: string };
}

interface ProductVariantInfo {
  id: string;
  price: number;
  offerPrice?: number;
  qty?: number;
  images?: string[];
  options?: VariantOptionInfo[];
}

interface ProductSummary {
  id: string | number;
  variantId?: string;
  variants?: ProductVariantInfo[];
  name: string;
  category: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  image: string;
  subimage?: string[];
  description?: string;
  isNewArrival?: boolean;
  isCustomerFavorite?: boolean;
}

const PRICE_RANGES = [
  { label: 'Under ₹2,000', value: '0-2000' },
  { label: '₹2,000 - ₹5,000', value: '2000-5000' },
  { label: '₹5,000 - ₹10,000', value: '5000-10000' },
  { label: 'Above ₹10,000', value: '10000-999999' },
];

// A variant's attribute values as a plain { attributeName: value } map, so the
// page can render exactly the variations the product actually has.
const variantOptionMap = (variant: ProductVariantInfo): Record<string, string> => {
  const map: Record<string, string> = {};
  (variant.options || []).forEach((option) => {
    const name = option.attribute?.name?.trim();
    const value = option.attributeValue?.value?.trim();
    if (name && value) map[name] = value;
  });
  return map;
};

const COLOR_HEX_MAP: Record<string, string> = {
  black: '#111111',
  white: '#F8FAFC',
  grey: '#7F8C8D',
  gray: '#7F8C8D',
  silver: '#BDC3C7',
  red: '#C0392B',
  maroon: '#7B241C',
  pink: '#E91E63',
  orange: '#E67E22',
  yellow: '#F1C40F',
  gold: '#DF9F28',
  green: '#2E7D32',
  teal: '#16A085',
  blue: '#2563EB',
  navy: '#1C2833',
  purple: '#6C3483',
  brown: '#795548',
  beige: '#D8C3A5',
  camel: '#C19A6B',
  cream: '#F5EBDD',
};

// Colour values are stored as names, so map them to a swatch colour; unknown
// names fall back to a neutral swatch instead of inventing a colour.
const colorHexFor = (value: string) => {
  const trimmed = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed;
  const key = trimmed.toLowerCase();
  if (COLOR_HEX_MAP[key]) return COLOR_HEX_MAP[key];
  const partial = Object.keys(COLOR_HEX_MAP).find((name) => key.includes(name));
  return partial ? COLOR_HEX_MAP[partial] : '#94A3B8';
};

function ProductDetailSkeleton() {
  return (
    <main className="flex-1 pb-24 select-none max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
        <div className="lg:col-span-7 flex flex-col-reverse lg:flex-row gap-4">
          <div className="flex lg:flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-20 h-24 rounded-xl bg-slate-200 animate-pulse shrink-0" />
            ))}
          </div>
          <div className="flex-1 aspect-[3/4] rounded-2xl bg-slate-200 animate-pulse" />
        </div>
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <div className="h-4 w-28 bg-amber-500/20 rounded animate-pulse" />
            <div className="h-8 w-4/5 bg-slate-200 rounded animate-pulse" />
            <div className="h-7 w-36 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          <div className="space-y-3 pt-2">
            <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}

function ProductCatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start select-none">
      <div className="hidden lg:block lg:col-span-3 space-y-6">
        <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-5 w-full bg-slate-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
      <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-lg bg-white border border-[#E2E8F0] p-3 space-y-2.5 animate-pulse">
            <div className="aspect-[3/4] w-full bg-slate-200 rounded-md" />
            <div className="space-y-1.5 pt-1">
              <div className="h-3 w-1/3 bg-slate-200 rounded" />
              <div className="h-4 w-full bg-slate-200 rounded" />
              <div className="h-4 w-2/3 bg-slate-200 rounded" />
            </div>
            <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
              <div className="h-5 w-20 bg-slate-200 rounded" />
              <div className="h-8 w-8 bg-slate-200 rounded-lg sm:hidden" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  // Query Params
  const selectedId = searchParams.get('id');
  const selectedCategoryParam = searchParams.get('category');
  const searchQueryParam = searchParams.get('search') || '';

  // Single Product State
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Accordion states
  const [openAccordions, setOpenAccordions] = useState<{ [key: string]: boolean }>({
    shipping: false,
  });

  // Catalog Filters State
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Data fetching state
  const [allProducts, setAllProducts] = useState<ProductSummary[]>([]);
  const [categoriesList, setCategoriesList] = useState<{ id: string; name: string }[]>([]);

  // Show Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 1. Initial category filter from URL param
  useEffect(() => {
    if (selectedCategoryParam) {
      setSelectedCategories([selectedCategoryParam]);
    } else {
      setSelectedCategories([]);
    }
  }, [selectedCategoryParam]);

  // 2. Fetch categories
  useEffect(() => {
    fetch(`${getApiUrl()}/categories`)
      .then((r) => r.json())
      .then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        if (list.length > 0) {
          setCategoriesList(list);
        }
      })
      .catch(() => {
        setCategoriesList([]);
      });
  }, []);

  // 3. Fetch products list
  useEffect(() => {
    let isMounted = true;
    setCatalogLoading(true);
    fetch(`${getApiUrl()}/products?limit=100`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: ProductSummary[] = res.data.map((p: any) => {
            const firstVariant = p.variants?.[0];
            const priceVal = Number(firstVariant?.offerPrice || firstVariant?.price || p.price || 0);
            const origPriceVal = firstVariant?.offerPrice && firstVariant.price > firstVariant.offerPrice ? firstVariant.price : undefined;
            return {
              id: p.id,
              variantId: firstVariant?.id,
              variants: p.variants,
              name: p.name,
              category: p.category?.name || 'Uncategorized',
              brand: p.brand?.name || 'Karteevo',
              price: priceVal,
              originalPrice: origPriceVal,
              image: p.image || p.images?.[0] || '',
              subimage: p.subimage && p.subimage.length > 0 ? p.subimage : (p.images || []),
              description: p.description || '',
              isNewArrival: p.isNewArrival || false,
              isCustomerFavorite: p.isCustomerFavorite || false,
            };
          });
          if (isMounted) {
            setAllProducts(mapped);
          }
        } else if (isMounted) {
          setAllProducts([]);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAllProducts([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setCatalogLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 4. Handle ?id= selected product
  useEffect(() => {
    if (!selectedId) {
      setSelectedProduct(null);
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    const found = allProducts.find((p) => String(p.id) === String(selectedId));
    if (found) {
      setSelectedProduct(found);
      setActiveImageIndex(0);
      setDetailLoading(false);
    } else {
      // Fetch specifically or fallback
      fetch(`${getApiUrl()}/products/${selectedId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.data) {
            const p = res.data;
            const firstVariant = p.variants?.[0];
            const priceVal = Number(firstVariant?.offerPrice || firstVariant?.price || p.price || 0);
            const origPriceVal = firstVariant?.offerPrice && firstVariant.price > firstVariant.offerPrice ? firstVariant.price : p.originalPrice;
            setSelectedProduct({
              id: p.id,
              variantId: firstVariant?.id,
              variants: p.variants,
              name: p.name,
              category: p.category?.name || 'Uncategorized',
              brand: p.brand?.name || 'Karteevo',
              price: priceVal,
              originalPrice: origPriceVal,
              image: p.image || p.images?.[0] || '',
              subimage: p.subimage && p.subimage.length > 0 ? p.subimage : (p.images || []),
              description: p.description,
              isNewArrival: p.isNewArrival,
              isCustomerFavorite: p.isCustomerFavorite,
            });
            setActiveImageIndex(0);
          } else {
            setSelectedProduct(null);
          }
        })
        .catch(() => {
          setSelectedProduct(null);
        })
        .finally(() => {
          setDetailLoading(false);
        });
    }
  }, [selectedId, allProducts]);

  // Variations come from the product's own variants, so the page shows the real
  // attribute values (including a single "All" option) instead of a fixed list.
  const variationGroups = useMemo(() => {
    const groups: { name: string; values: string[] }[] = [];
    (selectedProduct?.variants || []).forEach((variant) => {
      Object.entries(variantOptionMap(variant)).forEach(([name, value]) => {
        let group = groups.find((g) => g.name.toLowerCase() === name.toLowerCase());
        if (!group) {
          group = { name, values: [] };
          groups.push(group);
        }
        if (!group.values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
          group.values.push(value);
        }
      });
    });
    return groups;
  }, [selectedProduct]);

  // Fall back to the first value whenever a group has no valid selection yet.
  const selectedOptionMap = useMemo(() => {
    const map: Record<string, string> = {};
    variationGroups.forEach((group) => {
      const current = selectedOptions[group.name];
      map[group.name] = current && group.values.includes(current) ? current : group.values[0];
    });
    return map;
  }, [variationGroups, selectedOptions]);

  const selectedVariant = useMemo(() => {
    const variants = selectedProduct?.variants || [];
    if (variants.length === 0) return null;
    if (variationGroups.length === 0) return variants[0];
    return (
      variants.find((variant) => {
        const map = variantOptionMap(variant);
        return variationGroups.every(
          (group) => (map[group.name] || '').toLowerCase() === (selectedOptionMap[group.name] || '').toLowerCase()
        );
      }) || null
    );
  }, [selectedProduct, variationGroups, selectedOptionMap]);

  const optionSummary = useMemo(
    () => variationGroups.map((group) => selectedOptionMap[group.name]).filter(Boolean).join(', '),
    [variationGroups, selectedOptionMap]
  );

  const unitPrice = selectedVariant
    ? Number(selectedVariant.offerPrice || selectedVariant.price || selectedProduct?.price || 0)
    : selectedProduct?.price || 0;

  const unitOriginalPrice =
    selectedVariant?.offerPrice && selectedVariant.price > selectedVariant.offerPrice
      ? selectedVariant.price
      : selectedProduct?.originalPrice;

  // Gallery: the selected variant's own images come first, then the product
  // gallery, so changing a variation changes the picture shown.
  const currentImages = useMemo(() => {
    if (!selectedProduct) return [];
    const variantImages = (selectedVariant?.images || []).filter(Boolean);
    const productImages = [...(selectedProduct.subimage || []), selectedProduct.image].filter(Boolean);
    return Array.from(new Set([...variantImages, ...productImages]));
  }, [selectedProduct, selectedVariant]);

  const activeImageSrc = currentImages[activeImageIndex] || currentImages[0] || '';

  // A new variation starts from its own first image.
  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedVariant?.id]);

  const optionValue = (name: string) => {
    const key = Object.keys(selectedOptionMap).find((k) => k.toLowerCase() === name);
    return key ? selectedOptionMap[key] : '';
  };

  // A value is selectable only when a variant with that value exists for the
  // other currently chosen options.
  const isValueAvailable = (groupName: string, value: string) =>
    (selectedProduct?.variants || []).some((variant) => {
      const map = variantOptionMap(variant);
      if ((map[groupName] || '').toLowerCase() !== value.toLowerCase()) return false;
      return variationGroups.every(
        (group) =>
          group.name === groupName ||
          (map[group.name] || '').toLowerCase() === (selectedOptionMap[group.name] || '').toLowerCase()
      );
    });

  // Reset the selection to the first value of each group when the product changes.
  useEffect(() => {
    if (!selectedProduct) {
      setSelectedOptions({});
      return;
    }
    const defaults: Record<string, string> = {};
    (selectedProduct.variants || []).forEach((variant) => {
      Object.entries(variantOptionMap(variant)).forEach(([name, value]) => {
        if (!defaults[name]) defaults[name] = value;
      });
    });
    setSelectedOptions(defaults);
  }, [selectedProduct]);

  // Wishlist Check
  const isFavorited = selectedProduct ? isInWishlist(selectedProduct.id) : false;

  const handleWishlistToggle = () => {
    if (!selectedProduct) return;
    if (isFavorited) {
      removeFromWishlist(selectedProduct.id);
      showToast('Removed from wishlist');
    } else {
      addToWishlist({
        id: String(selectedProduct.id),
        productId: selectedProduct.id,
        title: selectedProduct.name,
        category: selectedProduct.category,
        price: selectedProduct.price,
        image: selectedProduct.image,
      });
      showToast('Added to wishlist');
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const activeVariantId = selectedVariant?.id || selectedProduct.variantId || selectedProduct.variants?.[0]?.id;

    addToCart(
      {
        id: selectedProduct.id,
        productId: selectedProduct.id,
        variantId: activeVariantId,
        size: optionValue('size') || '',
        color: optionValue('color') || optionValue('colour') || '',
        name: optionSummary ? `${selectedProduct.name} (${optionSummary})` : selectedProduct.name,
        price: unitPrice,
        image: activeImageSrc,
        category: selectedProduct.category,
      },
      quantity
    );
    showToast(`Added ${quantity} item(s) to cart`);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push('/cart');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: selectedProduct?.name || 'Karteevo Product',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Product link copied to clipboard');
    }
  };

  // Filter & Search Logic for Catalog View
  const filteredProducts = useMemo(() => {
    return allProducts.filter((prod) => {
      // Category filter
      if (selectedCategories.length > 0) {
        const matchCat = selectedCategories.some((c) =>
          prod.category.toLowerCase().includes(c.toLowerCase())
        );
        if (!matchCat) return false;
      }

      // Price Range filter
      if (selectedPriceRanges.length > 0) {
        const matchPrice = selectedPriceRanges.some((range) => {
          const [min, max] = range.split('-').map(Number);
          return prod.price >= min && prod.price <= max;
        });
        if (!matchPrice) return false;
      }

      // Search Query
      if (searchQueryParam) {
        const query = searchQueryParam.toLowerCase();
        return (
          prod.name.toLowerCase().includes(query) ||
          prod.category.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [allProducts, selectedCategories, selectedPriceRanges, searchQueryParam]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111111] font-sans flex flex-col justify-between">
      <Navbar />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0A192F] text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2.5 border border-[#061B3A] animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-[#DF9F28]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SINGLE PRODUCT DETAIL VIEW (When a product is selected via ?id=...)   */}
      {/* ========================================================================= */}
      {selectedId && detailLoading ? (
        <ProductDetailSkeleton />
      ) : selectedId && !selectedProduct ? (
        <main className="flex-1 py-16 px-4 max-w-xl mx-auto text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#111111]">Product Not Found</h2>
          <p className="text-sm text-[#555555]">
            The product you requested is currently unavailable, out of stock, or may have been archived.
          </p>
          <div className="pt-3 flex items-center justify-center gap-3">
            <Link
              href="/product"
              className="px-5 py-2.5 rounded-lg bg-[#0A192F] hover:bg-[#061B3A] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
            >
              Browse Catalog
            </Link>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-lg bg-white border border-slate-200 hover:border-[#DF9F28] text-[#111111] text-xs font-bold uppercase tracking-wider transition-colors shadow-2xs"
            >
              Home Page
            </Link>
          </div>
        </main>
      ) : selectedProduct ? (
        <main className="flex-1 pb-24">
          {/* Breadcrumbs Row */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <nav className="flex items-center gap-2 text-xs text-[#888888]">
              <Link href="/" className="hover:text-[#DF9F28] transition-colors">
                Home
              </Link>
              <span>/</span>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  router.push('/product');
                }}
                className="hover:text-[#DF9F28] transition-colors cursor-pointer"
              >
                All Products
              </button>
              <span>/</span>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  router.push(`/product?category=${encodeURIComponent(selectedProduct.category)}`);
                }}
                className="hover:text-[#DF9F28] transition-colors uppercase font-medium cursor-pointer"
              >
                {selectedProduct.category}
              </button>
              <span>/</span>
              <span className="text-[#111111] font-bold truncate max-w-[240px] sm:max-w-none">
                {selectedProduct.name}
              </span>
            </nav>
          </div>

          {/* Main Product Showcase Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
              
              {/* LEFT COLUMN: Gallery & Thumbnails */}
              <div className="lg:col-span-7">
                <div className="flex flex-col-reverse lg:flex-row gap-4">
                  
                  {/* Thumbnails Strip */}
                  <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto max-h-[580px] pb-2 lg:pb-0 scrollbar-none">
                    {currentImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative w-20 h-24 lg:w-20 lg:h-26 rounded-xl overflow-hidden bg-white shrink-0 border-2 transition-all cursor-pointer ${
                          activeImageIndex === idx
                            ? 'border-[#DF9F28] shadow-md ring-2 ring-[#FEF8EE]'
                            : 'border-slate-200 opacity-70 hover:opacity-100'
                        }`}
                        aria-label={`View image ${idx + 1}`}
                      >
                        <Image
                          src={img}
                          alt={`${selectedProduct.name} thumbnail ${idx + 1}`}
                          fill
                          unoptimized
                          sizes="80px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>

                  {/* Main Large Hero Image */}
                  <div
                    className="relative flex-1 aspect-[3/4] rounded-2xl overflow-hidden bg-white group border border-slate-200 shadow-sm cursor-crosshair"
                    onMouseEnter={() => setIsZoomed(true)}
                    onMouseLeave={() => setIsZoomed(false)}
                  >
                    {activeImageSrc ? (
                      <Image
                        src={activeImageSrc}
                        alt={`${selectedProduct.name} full view`}
                        fill
                        priority
                        unoptimized
                        sizes="(max-width: 1024px) 100vw, 55vw"
                        className={`object-cover transition-transform duration-300 ${isZoomed ? 'scale-125' : 'scale-100'}`}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#F8FAFC] text-slate-300">
                        <ShoppingBag className="h-12 w-12" />
                      </div>
                    )}

                    {/* Floating Zoom Badge */}
                    <div className="absolute bottom-3 right-3 z-10 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#555555] text-[11px] font-medium border border-slate-200 pointer-events-none flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shadow-2xs">
                      <ZoomIn className="w-3.5 h-3.5 text-[#DF9F28]" />
                      <span>Hover to Zoom</span>
                    </div>

                    {/* Mobile Carousel Arrow Controls */}
                    <div className="lg:hidden absolute inset-y-0 inset-x-2 flex items-center justify-between pointer-events-none">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : currentImages.length - 1));
                        }}
                        className="p-2 rounded-full bg-white/90 backdrop-blur-md shadow-md text-[#111111] pointer-events-auto hover:bg-white transition-colors"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIndex((prev) => (prev < currentImages.length - 1 ? prev + 1 : 0));
                        }}
                        className="p-2 rounded-full bg-white/90 backdrop-blur-md shadow-md text-[#111111] pointer-events-auto hover:bg-white transition-colors"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT COLUMN: Purchasing & Product Specifications */}
              <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
                
                {/* Category & Title */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest font-bold text-[#DF9F28]">
                      {selectedProduct.category}
                    </span>
                  </div>

                  <h1 className="font-sans text-xl sm:text-2xl lg:text-[28px] font-extrabold text-[#111111] leading-tight">
                    {selectedProduct.name}
                  </h1>

                  {/* Price */}
                  <div className="flex items-center gap-4 pt-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-bold text-[#111111]">
                        ₹{unitPrice.toLocaleString('en-IN')}
                      </span>
                      {unitOriginalPrice && unitOriginalPrice > unitPrice && (
                        <span className="text-sm text-[#888888] line-through">
                          ₹{unitOriginalPrice.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedProduct.description && (
                  <div className="space-y-2 text-xs sm:text-sm text-[#555555] leading-relaxed pt-1 border-t border-slate-200">
                    <p>{selectedProduct.description}</p>
                  </div>
                )}

                {/* Variation Selectors (values come from the product's variants) */}
                <div className="pt-2 border-t border-slate-200 space-y-5">
                  
                  {variationGroups.length === 0 ? (
                    <p className="text-xs text-[#555555]">
                      This product is available as a single option.
                    </p>
                  ) : (
                    variationGroups.map((group) => {
                      const currentValue = selectedOptionMap[group.name] || '';
                      const isColorGroup = /colou?r/i.test(group.name);
                      const remaining = typeof selectedVariant?.qty === 'number' ? selectedVariant.qty : undefined;

                      return (
                        <div key={group.name} className="space-y-2">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="font-semibold uppercase tracking-wider text-[#111111]">
                                {group.name}: <span className="font-normal normal-case text-[#555555]">{currentValue || '—'}</span>
                              </span>
                              {remaining !== undefined && remaining > 0 && remaining <= 5 && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-[#DF9F28]">
                                  <AlertCircle className="w-3 h-3 text-[#DF9F28]" />
                                  Only {remaining} remaining
                                </span>
                              )}
                              {remaining === 0 && (
                                <span className="text-[11px] font-bold text-rose-600">Out of stock</span>
                              )}
                            </div>

                          </div>

                          {isColorGroup ? (
                            <div className="flex flex-wrap items-center gap-3">
                              {group.values.map((value) => {
                                const available = isValueAvailable(group.name, value);
                                const active = currentValue === value;
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    title={available ? value : `${value} (unavailable)`}
                                    disabled={!available}
                                    onClick={() => setSelectedOptions((prev) => ({ ...prev, [group.name]: value }))}
                                    className={`relative flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                                      active
                                        ? 'scale-105 border-transparent ring-2 ring-[#DF9F28] ring-offset-2 shadow-xs'
                                        : available
                                        ? 'border-slate-300 hover:scale-105'
                                        : 'cursor-not-allowed border-slate-200 opacity-40'
                                    }`}
                                    style={{ backgroundColor: colorHexFor(value) }}
                                  >
                                    {active && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                                    <span className="sr-only">{value}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {group.values.map((value) => {
                                const available = isValueAvailable(group.name, value);
                                const active = currentValue === value;
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    disabled={!available}
                                    onClick={() => setSelectedOptions((prev) => ({ ...prev, [group.name]: value }))}
                                    className={`min-w-16 rounded-xl border px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                                      !available
                                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                                        : active
                                        ? 'border-[#0A192F] bg-[#0A192F] text-white shadow-sm'
                                        : 'border-slate-200 bg-white text-[#111111] hover:border-[#DF9F28] hover:text-[#DF9F28]'
                                    }`}
                                  >
                                    {value}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-4 pt-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
                      Quantity:
                    </span>
                    <div className="flex items-center border border-slate-200 rounded-full bg-white px-2 py-1 shadow-2xs">
                      <button
                        type="button"
                        disabled={quantity <= 1}
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-[#555555] hover:bg-[#FEF8EE] hover:text-[#DF9F28] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-semibold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-[#111111] font-mono">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => q + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-[#555555] hover:bg-[#FEF8EE] hover:text-[#DF9F28] transition-colors text-sm font-semibold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                </div>

                {/* Primary Purchasing Actions */}
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleAddToCart}
                      className="flex-1 py-3.5 px-6 rounded-xl bg-[#DF9F28] hover:bg-[#C6891E] text-[#111111] font-bold text-sm uppercase tracking-wider shadow-lg shadow-[#DF9F28]/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <ShoppingBag className="w-4 h-4 text-[#111111]" />
                      <span>Add to Bag • ₹{(unitPrice * quantity).toLocaleString('en-IN')}</span>
                    </button>

                    {/* Wishlist Button */}
                    <button
                      type="button"
                      onClick={handleWishlistToggle}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-[#DF9F28] transition-colors shadow-2xs text-[#111111] hover:bg-[#FEF8EE] cursor-pointer"
                      aria-label="Save to wishlist"
                    >
                      <Heart className={`w-5 h-5 ${isFavorited ? 'fill-[#DF9F28] text-[#DF9F28]' : ''}`} />
                    </button>

                    {/* Share Button */}
                    <button
                      type="button"
                      onClick={handleShare}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-[#DF9F28] transition-colors shadow-2xs text-[#111111] hover:bg-[#FEF8EE] cursor-pointer"
                      aria-label="Share product"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>

                    {/* Compare Button */}
                    <button
                      type="button"
                      onClick={() => showToast('Added to product comparison list')}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-[#DF9F28] transition-colors shadow-2xs text-[#111111] hover:bg-[#FEF8EE] cursor-pointer"
                      aria-label="Compare product"
                    >
                      <Scale className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    onClick={handleBuyNow}
                    className="w-full py-3.5 px-6 rounded-xl bg-[#0A192F] hover:bg-[#061B3A] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <span>Instant Checkout — Buy Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Trust Badges Strip */}
                <div className="grid grid-cols-3 gap-2 p-3.5 rounded-xl bg-[#FEF8EE] border border-[#DF9F28]/20 text-[11px] text-[#555555] text-center">
                  <div className="flex flex-col items-center gap-1">
                    <Truck className="w-4 h-4 text-[#DF9F28]" />
                    <span className="font-semibold text-[#111111]">Free Express Delivery</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <RotateCcw className="w-4 h-4 text-[#DF9F28]" />
                    <span className="font-semibold text-[#111111]">30-Day Easy Returns</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-[#DF9F28]" />
                    <span className="font-semibold text-[#111111]">Buyer Protection</span>
                  </div>
                </div>

                {/* Shipping & Returns */}
                <div className="border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleAccordion('shipping')}
                    className="flex w-full items-center justify-between py-4 text-left group cursor-pointer"
                    aria-expanded={openAccordions.shipping}
                  >
                    <span className="text-sm font-semibold text-[#111111] group-hover:text-[#DF9F28] transition-colors">
                      Shipping &amp; Returns
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#888888] group-hover:text-[#DF9F28] transition-transform duration-200 ${
                        openAccordions.shipping ? 'rotate-180 text-[#DF9F28]' : ''
                      }`}
                    />
                  </button>
                  {openAccordions.shipping && (
                    <div className="pb-5 pt-1 text-xs text-[#555555] leading-relaxed space-y-2 animate-in fade-in-50 duration-150">
                      <p>Complimentary express courier shipping across India on all verified customer orders above ₹999.</p>
                      <p>Dispatch occurs within 24–48 business hours with live end-to-end SMS tracking updates.</p>
                      <p>Hassle-free 30-day exchange window for sizing and silhouette tailoring preferences.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* RELATED & RECOMMENDED PRODUCTS SECTION                                    */}
          {/* ========================================================================= */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
            <div className="space-y-4">
              <div className="text-center space-y-0.5">
                <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.2em] text-[#DF9F28]">
                  Curated For You
                </span>
                <h2 className="font-sans text-xl sm:text-2xl font-semibold text-[#111111]">
                  Related &amp; Recommended Products
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4 pt-2">
                {allProducts
                  .filter((p) => String(p.id) !== String(selectedProduct.id))
                  .slice(0, 4)
                  .map((prod) => (
                    <ProductCard
                      key={prod.id}
                      id={prod.id}
                      variantId={prod.variantId || prod.variants?.[0]?.id}
                      name={prod.name}
                      description={prod.description}
                      category={prod.category}
                      brand={prod.brand || 'Karteevo'}
                      price={prod.price}
                      originalPrice={prod.originalPrice}
                      image={prod.image}
                      isNewArrival={prod.isNewArrival}
                      isCustomerFavorite={prod.isCustomerFavorite}
                    />
                  ))}
              </div>
            </div>
          </section>

          {/* Mobile Bottom Fixed Quick Buy Bar */}
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {activeImageSrc && (
                  <div className="relative w-11 h-13 rounded-lg overflow-hidden bg-white shrink-0 border border-slate-200">
                    <Image
                      src={activeImageSrc}
                      alt={selectedProduct.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                )}                <div className="min-w-0">
                  <p className="text-xs font-sans font-bold text-[#111111] truncate">
                    {selectedProduct.name}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-[#555555]">
                    <span className="font-bold text-[#111111]">
                      ₹{unitPrice.toLocaleString('en-IN')}
                    </span>
                    {optionSummary && (
                      <>
                        <span>•</span>
                        <span className="truncate">{optionSummary}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0 active:scale-95 bg-[#DF9F28] hover:bg-[#C6891E] text-[#111111] shadow-[#DF9F28]/20"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Add to Bag</span>
              </button>
            </div>
          </div>

        </main>
      ) : (
        /* ========================================================================= */
        /* 2. CATALOG LISTING VIEW (Default view when browsing /product)             */
        /* ========================================================================= */
        <main className="flex-1 py-6 md:py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            
            {/* Catalog Header */}
            <div className="space-y-1">
              <span className="text-xs font-bold tracking-[0.2em] text-[#DF9F28] uppercase">
                Karteevo Catalog
              </span>
              <h1 className="text-xl sm:text-2xl font-sans font-extrabold text-[#111111] tracking-tight">
                All Collections &amp; Apparel
              </h1>
              <p className="text-xs sm:text-sm text-[#555555]">
                Showing {filteredProducts.length} curated products
              </p>
            </div>

            {/* Filter Bar & Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0A192F] text-white text-xs font-bold hover:bg-[#061B3A] transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#DF9F28]" />
                  <span>Filters</span>
                </button>

                <p className="text-xs text-[#555555] hidden sm:block">
                  Filter by Category &amp; Price using the sidebar
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs text-[#555555] font-medium">Sort By:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-xs font-bold text-[#111111] bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-[#DF9F28]"
                >
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>
            </div>

            {/* Main Catalog Grid with Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Desktop Filters Sidebar */}
              <aside className={`lg:col-span-3 space-y-6 ${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
                  
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#111111]">
                      Filters
                    </span>
                    {(selectedCategories.length > 0 || selectedPriceRanges.length > 0) && (
                      <button
                        onClick={() => {
                          setSelectedCategories([]);
                          setSelectedPriceRanges([]);
                        }}
                        className="text-[11px] font-bold text-[#DF9F28] hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Categories Filter */}
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888] block">
                      Category
                    </span>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCategories([])}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          selectedCategories.length === 0
                            ? 'bg-[#FEF8EE] text-[#DF9F28] font-bold'
                            : 'text-[#555555] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        All Categories
                      </button>
                      {categoriesList.map((cat) => {
                        const isChecked = selectedCategories.includes(cat.name);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategories((prev) =>
                                isChecked ? prev.filter((c) => c !== cat.name) : [...prev, cat.name]
                              );
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                              isChecked
                                ? 'bg-[#FEF8EE] text-[#DF9F28] font-bold'
                                : 'text-[#555555] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <span>{cat.name}</span>
                            {isChecked && <Check className="w-3.5 h-3.5 text-[#DF9F28]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Price Ranges Filter */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888] block">
                      Price Range
                    </span>
                    <div className="space-y-2">
                      {PRICE_RANGES.map((pr) => {
                        const isChecked = selectedPriceRanges.includes(pr.value);
                        return (
                          <label
                            key={pr.value}
                            className="flex items-center gap-2.5 text-xs text-[#555555] cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedPriceRanges((prev) =>
                                  isChecked ? prev.filter((v) => v !== pr.value) : [...prev, pr.value]
                                );
                              }}
                              className="rounded border-slate-300 text-[#DF9F28] focus:ring-[#DF9F28] accent-[#DF9F28]"
                            />
                            <span>{pr.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </aside>

              {/* Products Catalog Cards Grid */}
              <div className="lg:col-span-9">
                {catalogLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div key={i} className="rounded-lg bg-white border border-[#E2E8F0] p-3 space-y-2.5 animate-pulse">
                        <div className="aspect-[3/4] w-full bg-slate-200 rounded-md" />
                        <div className="space-y-1.5 pt-1">
                          <div className="h-3 w-1/3 bg-slate-200 rounded" />
                          <div className="h-4 w-full bg-slate-200 rounded" />
                          <div className="h-4 w-2/3 bg-slate-200 rounded" />
                        </div>
                        <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
                          <div className="h-5 w-20 bg-slate-200 rounded" />
                          <div className="h-8 w-8 bg-slate-200 rounded-lg sm:hidden" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-lg border border-slate-200 p-6 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#FEF8EE] text-[#DF9F28] flex items-center justify-center mx-auto">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <h3 className="font-sans text-lg font-semibold text-[#111111]">
                      No products matched your criteria
                    </h3>
                    <p className="text-xs text-[#555555] max-w-sm mx-auto font-normal">
                      Try clearing filters or search terms to discover more items in our luxury catalog.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedCategories([]);
                        setSelectedPriceRanges([]);
                        router.push('/product');
                      }}
                      className="px-5 py-2 rounded-md bg-[#DF9F28] hover:bg-[#C6891E] text-[#111111] text-xs font-semibold tracking-wider uppercase transition-all shadow-2xs cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4">
                    {filteredProducts.map((prod) => (
                      <ProductCard
                        key={prod.id}
                        id={prod.id}
                        variantId={prod.variantId || prod.variants?.[0]?.id}
                        name={prod.name}
                        description={prod.description}
                        category={prod.category}
                        brand={prod.brand || 'Karteevo'}
                        price={prod.price}
                        originalPrice={prod.originalPrice}
                        image={prod.image}
                        isNewArrival={prod.isNewArrival}
                        isCustomerFavorite={prod.isCustomerFavorite}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        </main>
      )}

      <Footer />
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#DF9F28] border-t-transparent animate-spin" />
        </div>
      }
    >
      <ProductContent />
    </Suspense>
  );
}
