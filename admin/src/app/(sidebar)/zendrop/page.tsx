"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Package,
  Boxes,
  Key,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Percent,
  Truck,
  ExternalLink,
  Store,
  Trash2,
  Sliders,
  Check,
  Info,
  ImageIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";

const STOREFRONT_URL = process.env.NEXT_PUBLIC_WEB_URL || "https://www.karteevo.com";

interface ZendropSettings {
  isAuthorized: boolean;
  apiKey: string;
  maskedApiKey: string;
  hasApiKey: boolean;
  apiUrl: string;
  markupPercent: number;
  markupType: string;
  autoPublish: boolean;
  defaultBrandName: string;
  isConnected: boolean;
  lastSyncedAt?: string;
}

interface ZendropVariant {
  sku: string;
  wholesalePrice: number;
  qty: number;
  attributes: { name: string; value: string }[];
  images: string[];
}

interface ZendropCatalogItem {
  zendropId: string;
  name: string;
  description: string;
  categoryName: string;
  brandName: string;
  image: string;
  subimages: string[];
  wholesalePrice: number;
  suggestedRetailPrice: number;
  calculatedSellingPrice: number;
  calculatedListPrice: number;
  profitMargin: number;
  profitPercent: number;
  rating: number;
  ordersCount: number;
  shippingDays: string;
  variants: ZendropVariant[];
  isImported: boolean;
  dbProductId: string | null;
  isPermitted: boolean;
}

interface ImportedProduct {
  id: string;
  zendropId: string;
  name: string;
  description?: string;
  image: string;
  category: string;
  brand: string;
  wholesaleCost: number;
  storePrice: number;
  estimatedMargin: number;
  profitPercent?: number;
  totalStock: number;
  variantsCount: number;
  isPermitted: boolean;
  variants?: Array<{
    id: string;
    sku: string;
    price: number;
    offerPrice?: number;
    qty: number;
    images: string[];
    options?: Array<{ attribute?: string; value?: string }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = ["ALL", "Apparel", "Leather Goods", "Accessories", "Footwear"];

function formatMoney(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function ProductThumb({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
      {src ? (
        <Image src={src} alt={alt} fill sizes="44px" unoptimized className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

export default function ZendropIntegrationPage() {
  const [activeTab, setActiveTab] = useState("catalog");
  const [settings, setSettings] = useState<ZendropSettings>({
    isAuthorized: true,
    apiKey: "",
    maskedApiKey: "",
    hasApiKey: false,
    apiUrl: "https://api.zendrop.com",
    markupPercent: 35,
    markupType: "PERCENTAGE",
    autoPublish: true,
    defaultBrandName: "Steve John Atelier",
    isConnected: false,
  });

  const [inputApiKey, setInputApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTogglingPermission, setIsTogglingPermission] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
  const [connectionMessage, setConnectionMessage] = useState("");

  // Catalog state
  const [catalog, setCatalog] = useState<ZendropCatalogItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Detail modal state
  const [selectedProductDetails, setSelectedProductDetails] = useState<ZendropCatalogItem | ImportedProduct | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Imported products state
  const [importedProducts, setImportedProducts] = useState<ImportedProduct[]>([]);
  const [isLoadingImported, setIsLoadingImported] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Live calculator state
  const [calcWholesale, setCalcWholesale] = useState(4000);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch("/zendrop/settings");
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
        if (json.data.hasApiKey) {
          setConnectionStatus("success");
          setConnectionMessage("API key configured.");
        }
      }
    } catch (e) {
      console.error("Failed to load Zendrop settings", e);
    }
  };

  const fetchCatalog = async (query = searchQuery, category = selectedCategory) => {
    setIsLoadingCatalog(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("query", query);
      if (category && category !== "ALL") params.append("category", category);

      const res = await apiFetch(`/zendrop/catalog?${params.toString()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCatalog(json.data);
      }
    } catch {
      toast.error("Failed to load Zendrop catalog");
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const fetchImported = async () => {
    setIsLoadingImported(true);
    try {
      const res = await apiFetch("/zendrop/imported");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setImportedProducts(json.data);
      }
    } catch (e) {
      console.error("Failed to load imported products", e);
    } finally {
      setIsLoadingImported(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchCatalog();
    fetchImported();
  }, []);

  const handleToggleGlobalPermission = async (newAuthorizedState: boolean) => {
    setIsTogglingPermission(true);
    try {
      const payload = {
        isAuthorized: newAuthorizedState,
        apiUrl: settings.apiUrl,
        markupPercent: Number(settings.markupPercent),
        markupType: settings.markupType,
        autoPublish: settings.autoPublish,
        defaultBrandName: settings.defaultBrandName,
      };

      const res = await apiFetch("/zendrop/settings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setSettings(json.data);
        toast.success(
          newAuthorizedState ? "Storefront showcasing enabled." : "Storefront showcasing disabled."
        );
        fetchCatalog();
      } else {
        toast.error(json.error || "Failed to update permission");
      }
    } catch (e) {
      toast.error((e as Error).message || "An error occurred updating permission");
    } finally {
      setIsTogglingPermission(false);
    }
  };

  const handleToggleProductPermission = async (
    targetId: string,
    isImported: boolean,
    currentPermitted: boolean,
    catalogItem?: ZendropCatalogItem
  ) => {
    setActioningId(targetId);
    try {
      if (!isImported && catalogItem) {
        const res = await apiFetch("/zendrop/import", {
          method: "POST",
          body: JSON.stringify({
            zendropId: catalogItem.zendropId,
            customPrice: catalogItem.calculatedSellingPrice,
            isCustomerFavorite: false,
            isNewArrival: true,
            isPermitted: true,
          }),
        });

        const json = await res.json();
        if (json.success) {
          toast.success(json.message || `"${catalogItem.name}" is now live on the storefront.`);
          fetchCatalog();
          fetchImported();
        } else {
          toast.error(json.error || "Failed to grant permission");
        }
      } else {
        const res = await apiFetch(`/zendrop/toggle-permission/${targetId}`, {
          method: "POST",
          body: JSON.stringify({ isPermitted: !currentPermitted }),
        });

        const json = await res.json();
        if (json.success) {
          toast.success(
            json.message ||
              (json.isPermitted ? "Product is now visible on the storefront." : "Product hidden from the storefront.")
          );
          fetchCatalog();
          fetchImported();
        } else {
          toast.error(json.error || "Failed to update product permission");
        }
      }
    } catch (e) {
      toast.error((e as Error).message || "Action failed");
    } finally {
      setActioningId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const payload: Record<string, unknown> = {
        isAuthorized: settings.isAuthorized,
        apiUrl: settings.apiUrl,
        markupPercent: Number(settings.markupPercent),
        markupType: settings.markupType,
        autoPublish: settings.autoPublish,
        defaultBrandName: settings.defaultBrandName,
      };

      if (inputApiKey && inputApiKey.trim().length > 0) {
        payload.apiKey = inputApiKey.trim();
      }

      const res = await apiFetch("/zendrop/settings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Zendrop settings saved.");
        setSettings(json.data);
        setInputApiKey("");
        fetchCatalog();
      } else {
        toast.error(json.error || "Failed to save Zendrop settings");
      }
    } catch (e) {
      toast.error((e as Error).message || "An error occurred saving settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus("idle");
    setConnectionMessage("");
    try {
      const res = await apiFetch("/zendrop/test-connection", {
        method: "POST",
        body: JSON.stringify({ apiKey: inputApiKey.trim() || undefined }),
      });

      const json = await res.json();
      if (json.success && json.connected) {
        setConnectionStatus("success");
        setConnectionMessage(json.message || "Connected to Zendrop.");
        toast.success("Zendrop API connection verified.");
      } else {
        setConnectionStatus("error");
        setConnectionMessage(json.error || "Failed to authenticate with Zendrop.");
        toast.error(json.error || "Zendrop connection failed");
      }
    } catch (e) {
      setConnectionStatus("error");
      setConnectionMessage((e as Error).message || "Connection error");
      toast.error("Connection test failed");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSyncProduct = async (productId: string, productName: string) => {
    setSyncingId(productId);
    try {
      const res = await apiFetch(`/zendrop/sync/${productId}`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || `Synced "${productName}".`);
        fetchImported();
      } else {
        toast.error(json.error || "Failed to sync product");
      }
    } catch (e) {
      toast.error((e as Error).message || "Sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteImportedProduct = async (productId: string, productName: string) => {
    if (!confirm(`Remove "${productName}" from your store database?`)) return;

    setDeletingId(productId);
    try {
      const res = await apiFetch(`/zendrop/imported/${productId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || `Removed "${productName}".`);
        fetchImported();
        fetchCatalog();
      } else {
        toast.error(json.error || "Failed to remove product");
      }
    } catch (e) {
      toast.error((e as Error).message || "Failed to remove product");
    } finally {
      setDeletingId(null);
    }
  };

  const calcRetail = Math.round((calcWholesale * (1 + settings.markupPercent / 100)) / 10) * 10 - 1;
  const calcProfit = calcRetail - calcWholesale;
  const calcMarginPct = calcWholesale > 0 ? Math.round((calcProfit / calcWholesale) * 100) : 0;

  const activePermittedCount = importedProducts.filter((p) => p.isPermitted).length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 py-1">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <h1 className="text-2xl font-bold tracking-tight">Zendrop Dropshipping</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse the supplier catalog, control which products appear on the storefront, and manage your pricing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                settings.hasApiKey
                  ? "gap-1.5 border-emerald-200 bg-emerald-50 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "gap-1.5 border-amber-200 bg-amber-50 font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
              }
            >
              {settings.hasApiKey ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {settings.hasApiKey ? "API connected" : "API key missing"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => {
                fetchSettings();
                fetchCatalog();
                fetchImported();
                toast.info("Refreshed catalog and products.");
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Catalog items", value: catalog.length, icon: Package },
            { label: "On storefront", value: activePermittedCount, icon: Store },
            { label: "Markup", value: `+${settings.markupPercent}%`, icon: Percent },
            { label: "Avg. dispatch", value: "2–4 days", icon: Truck },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{stat.value}</p>
              </div>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="catalog" className="gap-1.5">
              <Package className="h-4 w-4" />
              Catalog
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                {catalog.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="imported" className="gap-1.5">
              <Boxes className="h-4 w-4" />
              On storefront
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                {activePermittedCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Sliders className="h-4 w-4" />
              Pricing &amp; API
            </TabsTrigger>
          </TabsList>

          {/* ── CATALOG ── */}
          <TabsContent value="catalog" className="mt-0">
            <Card className="overflow-hidden">
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Supplier catalog</CardTitle>
                    <CardDescription>
                      Grant permission to publish an item on the storefront. Nothing is visible until you do.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search products…"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          fetchCatalog(e.target.value, selectedCategory);
                        }}
                        className="h-9 w-full pl-8 sm:w-64"
                      />
                    </div>
                    <Select
                      value={selectedCategory}
                      onValueChange={(value) => {
                        setSelectedCategory(value);
                        fetchCatalog(searchQuery, value);
                      }}
                    >
                      <SelectTrigger className="h-9 w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat === "ALL" ? "All categories" : cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t border-border">
                  <Table className="min-w-[820px]">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-10 px-4 text-xs uppercase tracking-wide text-muted-foreground">
                          Product
                        </TableHead>
                        <TableHead className="h-10 px-4 text-xs uppercase tracking-wide text-muted-foreground">
                          Category
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                          Cost
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                          Store price
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                          Margin
                        </TableHead>
                        <TableHead className="h-10 px-4 text-xs uppercase tracking-wide text-muted-foreground">
                          Status
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingCatalog ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-28 text-center text-sm text-muted-foreground">
                            Loading catalog…
                          </TableCell>
                        </TableRow>
                      ) : catalog.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-28 text-center text-sm text-muted-foreground">
                            No products match this search or category.
                          </TableCell>
                        </TableRow>
                      ) : (
                        catalog.map((item) => {
                          const isItemActioning =
                            actioningId === item.zendropId ||
                            (!!item.dbProductId && actioningId === item.dbProductId);

                          return (
                            <TableRow key={item.zendropId}>
                              <TableCell className="px-4 py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <ProductThumb src={item.image} alt={item.name} />
                                  <div className="min-w-0 max-w-[260px]">
                                    <p className="truncate font-medium text-foreground" title={item.name}>
                                      {item.name}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {item.zendropId} · {item.variants.length} variants ·★ {item.rating}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3">
                                <span className="text-sm text-muted-foreground">{item.categoryName}</span>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right text-sm tabular-nums">
                                {formatMoney(item.wholesalePrice)}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                                {formatMoney(item.calculatedSellingPrice)}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                                +{formatMoney(item.profitMargin)}
                              </TableCell>
                              <TableCell className="px-4 py-3">
                                {item.isImported && item.isPermitted ? (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 border-emerald-200 bg-emerald-50 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Visible
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                                    <Lock className="h-3 w-3" />
                                    Hidden
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1.5 px-2 text-xs"
                                    onClick={() => {
                                      setSelectedProductDetails(item);
                                      setIsDetailsOpen(true);
                                    }}
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                    Details
                                  </Button>

                                  {item.isImported && item.isPermitted ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isItemActioning}
                                      className="h-8 gap-1.5 px-2 text-xs text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        handleToggleProductPermission(
                                          item.dbProductId || item.zendropId,
                                          true,
                                          true,
                                          item
                                        )
                                      }
                                    >
                                      {isItemActioning ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Lock className="h-3.5 w-3.5" />
                                      )}
                                      Hide
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      disabled={isItemActioning}
                                      className="h-8 gap-1.5 px-2 text-xs"
                                      onClick={() =>
                                        handleToggleProductPermission(
                                          item.dbProductId || item.zendropId,
                                          item.isImported,
                                          item.isPermitted,
                                          item
                                        )
                                      }
                                    >
                                      {isItemActioning ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Unlock className="h-3.5 w-3.5" />
                                      )}
                                      Publish
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ON STOREFRONT ── */}
          <TabsContent value="imported" className="mt-0">
            <Card className="overflow-hidden">
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Products in your store</CardTitle>
                    <CardDescription>
                      Toggle visibility, sync supplier pricing, or remove an imported product.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={fetchImported}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t border-border">
                  <Table className="min-w-[860px]">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-10 px-4 text-xs uppercase tracking-wide text-muted-foreground">
                          Product
                        </TableHead>
                        <TableHead className="h-10 px-4 text-xs uppercase tracking-wide text-muted-foreground">
                          SKU
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                          Cost
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                          Store price
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                          Margin
                        </TableHead>
                        <TableHead className="h-10 px-4 text-xs uppercase tracking-wide text-muted-foreground">
                          Stock
                        </TableHead>
                        <TableHead className="h-10 px-4 text-xs uppercase tracking-wide text-muted-foreground">
                          Visibility
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingImported ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-28 text-center text-sm text-muted-foreground">
                            Loading products…
                          </TableCell>
                        </TableRow>
                      ) : importedProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-28 text-center text-sm text-muted-foreground">
                            No Zendrop products imported yet. Publish one from the Catalog tab.
                          </TableCell>
                        </TableRow>
                      ) : (
                        importedProducts.map((p) => {
                          const isActioning = actioningId === p.id;

                          return (
                            <TableRow key={p.id}>
                              <TableCell className="px-4 py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <ProductThumb src={p.image} alt={p.name} />
                                  <div className="min-w-0 max-w-[240px]">
                                    <p className="truncate font-medium text-foreground" title={p.name}>
                                      {p.name}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {p.brand} · {p.variantsCount} variants
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3">
                                <span className="font-mono text-xs text-muted-foreground">{p.zendropId}</span>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right text-sm tabular-nums">
                                {formatMoney(p.wholesaleCost)}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                                {formatMoney(p.storePrice)}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                                +{formatMoney(p.estimatedMargin)}
                              </TableCell>
                              <TableCell className="px-4 py-3">
                                <span
                                  className={`text-sm tabular-nums ${
                                    p.totalStock > 20
                                      ? "text-foreground"
                                      : "font-medium text-amber-600 dark:text-amber-400"
                                  }`}
                                >
                                  {p.totalStock}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isActioning}
                                  onClick={() => handleToggleProductPermission(p.id, true, p.isPermitted)}
                                  className={`h-8 gap-1.5 px-2 text-xs font-medium ${
                                    p.isPermitted
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {isActioning ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : p.isPermitted ? (
                                    <Eye className="h-3 w-3" />
                                  ) : (
                                    <EyeOff className="h-3 w-3" />
                                  )}
                                  {p.isPermitted ? "Visible" : "Hidden"}
                                </Button>
                              </TableCell>
                              <TableCell className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title="Details"
                                    onClick={() => {
                                      setSelectedProductDetails(p);
                                      setIsDetailsOpen(true);
                                    }}
                                  >
                                    <Info className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title="View on storefront"
                                    asChild
                                  >
                                    <a
                                      href={`${STOREFRONT_URL}/product?id=${p.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Store className="h-4 w-4" />
                                    </a>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title="Sync pricing and inventory"
                                    disabled={syncingId === p.id}
                                    onClick={() => handleSyncProduct(p.id, p.name)}
                                  >
                                    <RefreshCw
                                      className={`h-4 w-4 ${syncingId === p.id ? "animate-spin" : ""}`}
                                    />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit product" asChild>
                                    <Link href={`/products/edit-product/${p.id}`}>
                                      <ExternalLink className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
                                    title="Remove product"
                                    disabled={deletingId === p.id}
                                    onClick={() => handleDeleteImportedProduct(p.id, p.name)}
                                  >
                                    {deletingId === p.id ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PRICING & API ── */}
          <TabsContent value="settings" className="mt-0">
            <form onSubmit={handleSaveSettings} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    Connection
                  </CardTitle>
                  <CardDescription>Credentials used to talk to the Zendrop API.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="apiKey">API key</Label>
                    <div className="relative">
                      <Input
                        id="apiKey"
                        type={showApiKey ? "text" : "password"}
                        placeholder={
                          settings.hasApiKey
                            ? `Configured (${settings.maskedApiKey})`
                            : "Enter your Zendrop API key"
                        }
                        value={inputApiKey}
                        onChange={(e) => setInputApiKey(e.target.value)}
                        className="h-9 pr-10 font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                      >
                        {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Find it in your Zendrop account under Settings → Integrations → API.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="apiUrl">API base URL</Label>
                    <Input
                      id="apiUrl"
                      value={settings.apiUrl}
                      onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                      placeholder="https://api.zendrop.com"
                      className="h-9 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="defaultBrandName">Default brand for imports</Label>
                    <Input
                      id="defaultBrandName"
                      value={settings.defaultBrandName}
                      onChange={(e) => setSettings({ ...settings, defaultBrandName: e.target.value })}
                      placeholder="Steve John Atelier"
                      className="h-9"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="h-9 gap-1.5"
                    >
                      {isTestingConnection ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      Test connection
                    </Button>

                    {connectionStatus === "success" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {connectionMessage || "Connection verified"}
                      </span>
                    )}
                    {connectionStatus === "error" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {connectionMessage || "Authentication failed"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Storefront showcasing</p>
                      <p className="text-xs text-muted-foreground">
                        Master switch for all imported Zendrop products.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isTogglingPermission}
                      onClick={() => handleToggleGlobalPermission(!settings.isAuthorized)}
                      className="gap-1.5"
                    >
                      {isTogglingPermission ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : settings.isAuthorized ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      {settings.isAuthorized ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    Pricing
                  </CardTitle>
                  <CardDescription>Markup applied to supplier cost on import.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="markupPercent">Markup percentage</Label>
                      <div className="relative">
                        <Input
                          id="markupPercent"
                          type="number"
                          min={0}
                          max={500}
                          value={settings.markupPercent}
                          onChange={(e) =>
                            setSettings({ ...settings, markupPercent: Number(e.target.value) })
                          }
                          className="h-9 pr-8 font-mono"
                        />
                        <Percent className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="calcWholesale">Sample cost (₹)</Label>
                      <Input
                        id="calcWholesale"
                        type="number"
                        value={calcWholesale}
                        onChange={(e) => setCalcWholesale(Number(e.target.value) || 0)}
                        className="h-9 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Supplier cost</span>
                      <span className="font-mono tabular-nums">{formatMoney(calcWholesale)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Markup</span>
                      <span className="font-mono tabular-nums">+{settings.markupPercent}%</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <span className="font-medium">Store price</span>
                      <span className="font-mono font-semibold tabular-nums">{formatMoney(calcRetail)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        Profit ({calcMarginPct}%)
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        +{formatMoney(calcProfit)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button type="submit" disabled={isSavingSettings} className="gap-1.5">
                      {isSavingSettings ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {isSavingSettings ? "Saving…" : "Save settings"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </TabsContent>
        </Tabs>
      </div>

      {/* Product details */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {selectedProductDetails && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedProductDetails.zendropId}
                  </Badge>
                  {"isPermitted" in selectedProductDetails && (
                    <Badge
                      variant="outline"
                      className={
                        selectedProductDetails.isPermitted
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }
                    >
                      {selectedProductDetails.isPermitted ? "Visible on storefront" : "Hidden"}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="pt-1 text-lg">{selectedProductDetails.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  {"categoryName" in selectedProductDetails
                    ? selectedProductDetails.categoryName
                    : selectedProductDetails.category}
                  {" · "}
                  {"brandName" in selectedProductDetails
                    ? selectedProductDetails.brandName
                    : selectedProductDetails.brand}
                </DialogDescription>
              </DialogHeader>

              <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                {selectedProductDetails.image ? (
                  <Image
                    src={selectedProductDetails.image}
                    alt={selectedProductDetails.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Supplier cost</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                    {formatMoney(
                      "wholesalePrice" in selectedProductDetails
                        ? selectedProductDetails.wholesalePrice
                        : selectedProductDetails.wholesaleCost
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-900 dark:bg-amber-950/40">
                  <p className="text-xs text-amber-700 dark:text-amber-400">Store price</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {formatMoney(
                      "calculatedSellingPrice" in selectedProductDetails
                        ? selectedProductDetails.calculatedSellingPrice
                        : selectedProductDetails.storePrice
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Profit</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    +{formatMoney(
                      "profitMargin" in selectedProductDetails
                        ? selectedProductDetails.profitMargin
                        : selectedProductDetails.estimatedMargin
                    )}
                  </p>
                </div>
              </div>

              {selectedProductDetails.description && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Description</p>
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed text-foreground">
                    {selectedProductDetails.description}
                  </p>
                </div>
              )}

              {"variants" in selectedProductDetails &&
                Array.isArray(selectedProductDetails.variants) &&
                selectedProductDetails.variants.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Variants ({selectedProductDetails.variants.length})
                    </p>
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {selectedProductDetails.variants.map((v, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                        >
                          <span className="font-mono text-foreground">
                            {"sku" in v && v.sku ? v.sku : `Variant ${idx + 1}`}
                          </span>
                          <span className="text-muted-foreground">{v.qty} in stock</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const dbId =
                      ("dbProductId" in selectedProductDetails && selectedProductDetails.dbProductId) ||
                      ("id" in selectedProductDetails ? selectedProductDetails.id : null);
                    if (!dbId) return null;
                    return (
                      <>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                          <a
                            href={`${STOREFRONT_URL}/product?id=${dbId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Store className="h-3.5 w-3.5" />
                            View on storefront
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                          <Link href={`/products/edit-product/${dbId}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Edit product
                          </Link>
                        </Button>
                      </>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsDetailsOpen(false)}>
                    Close
                  </Button>
                  {"isPermitted" in selectedProductDetails && (
                    <Button
                      size="sm"
                      className={`text-xs ${
                        selectedProductDetails.isPermitted
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : ""
                      }`}
                      onClick={() => {
                        const id =
                          "dbProductId" in selectedProductDetails && selectedProductDetails.dbProductId
                            ? selectedProductDetails.dbProductId
                            : "id" in selectedProductDetails
                              ? selectedProductDetails.id
                              : selectedProductDetails.zendropId;
                        const isItemImp =
                          "isImported" in selectedProductDetails ? selectedProductDetails.isImported : true;
                        handleToggleProductPermission(
                          id,
                          isItemImp,
                          selectedProductDetails.isPermitted,
                          "wholesalePrice" in selectedProductDetails
                            ? (selectedProductDetails as ZendropCatalogItem)
                            : undefined
                        );
                        setIsDetailsOpen(false);
                      }}
                    >
                      {selectedProductDetails.isPermitted ? "Hide from storefront" : "Publish to storefront"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
