"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useConfigurableProduct } from "@/context/ConfigurableProductContext";

export default function ProductFormSection() {
  const { baseProduct, setBaseProduct } = useConfigurableProduct();

  return (
    <Card className="w-full h-full shadow-none border-none">
      <CardHeader className="pb-3">
        <CardTitle>Basic Product Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-2">
          <Label htmlFor="productName">
            Product Name <span className="text-red-500">*</span>
          </Label>
          <Input
            required
            id="productName"
            value={baseProduct.name}
            onChange={(e) =>
              setBaseProduct({ ...baseProduct, name: e.target.value })
            }
            placeholder="Enter product name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            Product Description <span className="text-red-500">*</span>
          </Label>
          <Textarea
            required
            id="description"
            value={baseProduct.description}
            onChange={(e) =>
              setBaseProduct({ ...baseProduct, description: e.target.value })
            }
            className="min-h-[140px]"
            placeholder="Enter product description"
          />
        </div>
      </CardContent>
    </Card>
  );
}
