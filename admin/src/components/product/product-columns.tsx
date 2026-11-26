"use client";

import { ProductDetail } from "@/types/product";
import { ProductDeleteDialog } from "./delete-product-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Edit2,
  Eye,
  ImageIcon,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Label } from "../ui/label";
import { API_URL } from "@/lib/api-client";
import { toast } from "sonner";

export const productColumns: ColumnDef<ProductDetail>[] = [
  {
    accessorKey: "image",
    header: "Product",
    size: 64,
    cell: ({ row }) => {
      const image = row.getValue("image") as string | null;
      return (
        <div className="relative h-11 w-11 overflow-hidden rounded-lg border border-border bg-muted">
          {image ? (
            <Image
              src={image}
              alt={row.original.name || "Product"}
              fill
              sizes="44px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      const sort = column.getIsSorted();
      const renderIcon = () => {
        if (!sort) return <ArrowUpDown className="size-3.5 opacity-60" />;
        if (sort === "asc") return <ArrowUp className="size-3.5" />;
        if (sort === "desc") return <ArrowDown className="size-3.5" />;
        return null;
      };

      return (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 gap-1.5 px-2 font-medium"
          onClick={() => column.toggleSorting(sort === "asc")}
        >
          Name
          {renderIcon()}
        </Button>
      );
    },
    cell: ({ row }) => {
      const variants = row.original.variants || [];
      return (
        <div className="min-w-0 max-w-[220px]">
          <p className="truncate font-medium text-foreground" title={row.original.name}>
            {row.original.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {variants.length} variant{variants.length === 1 ? "" : "s"}
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    meta: { className: "hidden xl:table-cell" },
    cell: ({ row }) => {
      const desc = row.getValue("description") as string | null;
      if (!desc) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <p
          className="line-clamp-2 max-w-[200px] text-xs leading-relaxed text-muted-foreground"
          title={desc}
        >
          {desc}
        </p>
      );
    },
  },
  {
    accessorKey: "price",
    header: () => <div className="text-right">Price</div>,
    cell: ({ row }) => {
      const variants = row.original.variants || [];
      const prices = variants.map((v) => v.price).filter((p) => typeof p === "number");
      if (prices.length === 0) {
        return <div className="text-right text-sm text-muted-foreground">—</div>;
      }

      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      return (
        <div className="whitespace-nowrap text-right">
          <div className="font-semibold tabular-nums text-foreground">
            {formatCurrency(minPrice)}
          </div>
          {minPrice !== maxPrice && (
            <div className="text-xs tabular-nums text-muted-foreground">
              to {formatCurrency(maxPrice)}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "qty",
    header: "Stock",
    cell: ({ row }) => {
      const variants = row.original.variants || [];
      const qty = variants.reduce((sum, v) => sum + (v.qty || 0), 0);
      if (variants.length === 0) {
        return (
          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            Out of stock
          </span>
        );
      }
      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            qty > 0
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
          }`}
        >
          {qty > 0 ? `${qty} in stock` : "Out of stock"}
        </span>
      );
    },
  },
  {
    accessorKey: "brand",
    header: "Brand",
    meta: { className: "hidden 2xl:table-cell" },
    cell: ({ row }) => (
      <span className="block max-w-[110px] truncate text-sm">
        {row.original.brand?.name || "—"}
      </span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    meta: { className: "hidden lg:table-cell" },
    cell: ({ row }) => (
      <span className="block max-w-[120px] truncate text-sm">
        {row.original.category?.name || "—"}
      </span>
    ),
  },
  {
    accessorKey: "subcategory",
    header: "Subcategory",
    meta: { className: "hidden 2xl:table-cell" },
    cell: ({ row }) => (
      <span className="block max-w-[120px] truncate text-sm">
        {row.original.subCategory?.name || "—"}
      </span>
    ),
  },
  {
    id: "action",
    size: 48,
    cell: ({ row }) => {
      return row.original && <ProductDropdownMenu product={row.original} />;
    },
  },
];

export const ProductDropdownMenu = ({ product }: { product: ProductDetail }) => {
  const [openDelete, setOpenDelete] = useState(false);
  const [openAddVariant, setOpenAddVariant] = useState(false);
  const router = useRouter();

  const handleEditClick = () => {
    router.push(`/products/edit-product/${product.id}`);
  };

  const handleDeleteClick = () => {
    setOpenDelete(true);
  };

  const handleViewClick = () => {
    
    router.push(`/products/${product.id}`);
  };

  return (
    <div className="text-right">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleViewClick}>
            <Eye className="size-4 mr-2" />
            View
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={handleEditClick}>
            <Edit2 className="size-4 mr-2" />
            Edit Product
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onSelect={handleDeleteClick}
          >
            <Trash2 className="size-4 mr-2" />
            Delete Product
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Dialog */}
      <ProductDeleteDialog
        product={product}
        open={openDelete}
        setOpen={setOpenDelete}
      />
      {openAddVariant && <InlineAddVariant productId={product.id} onClose={() => setOpenAddVariant(false)} />}
    </div>
  );
};


function InlineAddVariant({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [attributes, setAttributes] = useState<{ id: string; name: string; values: { id: string; value: string }[] }[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<{ attributeId: string; valueId: string }[]>([]);
  const [loadingAttributes, setLoadingAttributes] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingAttributes(true);
      try {
        const res = await fetch(`${API_URL}/attributes`);
        const data = await res.json();
        setAttributes(data || []);
      } finally {
        setLoadingAttributes(false);
      }
    })();
  }, []);

  const setOption = (attributeId: string, valueId: string) => {
    setSelectedOptions((prev) => {
      const without = prev.filter(o => o.attributeId !== attributeId);
      return [...without, { attributeId, valueId }];
    });
  };

  const submit = async () => {
    setSubmitting(true);
    try {
        const form = new FormData();
        form.append("productId", productId);
        form.append("price", price);
        form.append("qty", qty);
        files.forEach((f) => form.append("images", f));
        form.append("options", JSON.stringify(selectedOptions));
        
        const response = await fetch(`${API_URL}/variants`, {
            method: "POST",
            body: form
        });
        
        if (response.ok) {
            toast.success("Variant added successfully");
            onClose();
        } else {
            const err = await response.json();
            toast.error(err.error || "Failed to add variant");
        }
    } catch {
        toast.error("An error occurred");
    } finally {
        setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Add Variant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingAttributes ? (
            <div className="text-center py-6">Loading attributes...</div>
          ) : (
            attributes.map(attr => (
              <div key={attr.id} className="space-y-2">
                <Label>{attr.name}</Label>
                <Select
                  value={selectedOptions.find(o => o.attributeId === attr.id)?.valueId || ''}
                  onValueChange={(value) => setOption(attr.id, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    {attr.values.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))
          )}

          <div className="space-y-2">
            <Label>Price</Label>
            <Input type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Images</Label>
            <Input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !price || !qty || files.length === 0}>
            {submitting ? "Saving..." : "Save Variant"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
