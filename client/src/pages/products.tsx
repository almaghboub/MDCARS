import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { Plus, Pencil, Trash2, Search, Package, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import type { ProductWithCategory } from "@shared/schema";

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  costPrice: z.string().min(1, "Cost price is required"),
  sellingPrice: z.string().min(1, "Selling price is required"),
  description: z.string().optional(),
  lowStockThreshold: z.number().min(0).default(5),
  currentStock: z.number().min(0).default(0),
  purchaseType: z.enum(["cash", "credit"]).default("cash"),
  stockCurrency: z.enum(["LYD", "USD"]).default("LYD"),
  supplierName: z.string().optional(),
  invoiceNumber: z.string().optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

const categoryFormSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
});

export default function Products() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === "owner" || user?.role === "stock_manager";
  const [nameInputValue, setNameInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: products = [], isLoading } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products"],
  });

  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      costPrice: "",
      sellingPrice: "",
      description: "",
      lowStockThreshold: 5,
      currentStock: 0,
      purchaseType: "cash",
      stockCurrency: "LYD",
      supplierName: "",
      invoiceNumber: "",
    },
  });

  const categoryForm = useForm<z.infer<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: "", description: "" },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const res = await apiRequest("POST", "/api/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goods-capital"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-payables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      toast({ title: t("productCreated") });
      setIsProductDialogOpen(false);
      productForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductFormData> }) => {
      const res = await apiRequest("PATCH", `/api/products/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: t("productUpdated") });
      setIsProductDialogOpen(false);
      setEditingProduct(null);
      productForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: t("productDeleted") });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof categoryFormSchema>) => {
      const res = await apiRequest("POST", "/api/categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: t("categoryCreated") });
      setIsCategoryDialogOpen(false);
      categoryForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditProduct = (product: ProductWithCategory) => {
    setEditingProduct(product);
    setNameInputValue(product.name);
    setShowSuggestions(false);
    productForm.reset({
      name: product.name,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      description: product.description || "",
      lowStockThreshold: product.lowStockThreshold,
      currentStock: product.currentStock,
    });
    setIsProductDialogOpen(true);
  };

  const onProductSubmit = (data: ProductFormData) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data });
    } else {
      createProductMutation.mutate(data);
    }
  };

  const nameSuggestions = useMemo(() => {
    if (!nameInputValue || nameInputValue.length < 1 || editingProduct) return [];
    const query = nameInputValue.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(query));
  }, [nameInputValue, products, editingProduct]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (product: ProductWithCategory) => {
    setShowSuggestions(false);
    setEditingProduct(product);
    setNameInputValue(product.name);
    productForm.reset({
      name: product.name,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      description: product.description || "",
      lowStockThreshold: product.lowStockThreshold,
      currentStock: product.currentStock,
    });
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-products-title">{t("products")}</h1>
          <p className="text-muted-foreground">{t("manageProductCatalog")}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-category">
                <Plus className="w-4 h-4 mr-2" />
                {t("addCategory")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("addCategory")}</DialogTitle>
              </DialogHeader>
              <Form {...categoryForm}>
                <form onSubmit={categoryForm.handleSubmit((data) => createCategoryMutation.mutate(data))} className="space-y-4">
                  <FormField control={categoryForm.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("name")}</FormLabel>
                      <FormControl><Input {...field} data-testid="input-category-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={categoryForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("description")}</FormLabel>
                      <FormControl><Textarea {...field} data-testid="input-category-description" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={createCategoryMutation.isPending} data-testid="button-save-category">
                    {createCategoryMutation.isPending ? t("saving") : t("saveCategory")}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>}
          {canEdit && <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
            setIsProductDialogOpen(open);
            if (!open) {
              setEditingProduct(null);
              productForm.reset();
              setNameInputValue("");
              setShowSuggestions(false);
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-product">
                <Plus className="w-4 h-4 mr-2" />
                {t("addProduct")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingProduct ? t("editProduct") : t("addProduct")}</DialogTitle>
              </DialogHeader>
              <Form {...productForm}>
                <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={productForm.control} name="name" render={({ field }) => (
                      <FormItem className="relative">
                        <FormLabel>{t("productName")}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-product-name"
                            autoComplete="off"
                            value={field.value}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              setNameInputValue(e.target.value);
                              setShowSuggestions(true);
                            }}
                            onFocus={() => {
                              if (nameInputValue && !editingProduct) setShowSuggestions(true);
                            }}
                          />
                        </FormControl>
                        {showSuggestions && nameSuggestions.length > 0 && (
                          <div
                            ref={suggestionsRef}
                            className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
                          >
                            <div className="px-3 py-2 text-xs text-muted-foreground font-medium border-b">
                              {t("similarProductsFound")}
                            </div>
                            {nameSuggestions.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                data-testid={`suggestion-product-${p.id}`}
                                className="w-full text-left px-3 py-2 hover:bg-accent cursor-pointer flex items-center justify-between text-sm"
                                onClick={() => handleSelectSuggestion(p)}
                              >
                                <span className="font-medium">{p.name}</span>
                                <span className="text-muted-foreground text-xs">{p.sku} · {t("stock")}: {p.currentStock}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={productForm.control} name="costPrice" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("costPrice")}</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} data-testid="input-product-cost" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={productForm.control} name="sellingPrice" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("sellingPrice")}</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} data-testid="input-product-price" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={productForm.control} name="currentStock" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("initialStock")}</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-product-stock" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={productForm.control} name="lowStockThreshold" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("lowStockAlertThreshold")}</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-product-threshold" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  {!editingProduct && productForm.watch("currentStock") > 0 && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                      <p className="text-sm font-medium text-muted-foreground">{t("purchaseType")}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={productForm.control} name="purchaseType" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("purchaseType")}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-purchase-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="cash">{t("paidNow")}</SelectItem>
                                <SelectItem value="credit">{t("onCredit")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={productForm.control} name="stockCurrency" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("currency")}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-stock-currency">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="LYD">LYD</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={productForm.control} name="supplierName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("supplierName")}</FormLabel>
                            <FormControl><Input {...field} placeholder={t("optional")} data-testid="input-supplier-name" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={productForm.control} name="invoiceNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("invoiceNumber")}</FormLabel>
                            <FormControl><Input {...field} placeholder={t("optional")} data-testid="input-invoice-number" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  )}
                  <FormField control={productForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("description")}</FormLabel>
                      <FormControl><Textarea {...field} data-testid="input-product-description" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={createProductMutation.isPending || updateProductMutation.isPending} data-testid="button-save-product">
                    {createProductMutation.isPending || updateProductMutation.isPending ? t("saving") : editingProduct ? t("updateProduct") : t("addProduct")}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t("productCatalog")} ({filteredProducts.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchProducts")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-products"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{t("loading")}</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t("noProductsFound")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead>{t("sku")}</TableHead>
                  {canEdit && <TableHead>{t("cost")}</TableHead>}
                  <TableHead>{t("price")}</TableHead>
                  <TableHead>{t("stock")}</TableHead>
                  {canEdit && <TableHead>{t("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} data-testid={`product-row-${product.id}`}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku}</TableCell>
                    {canEdit && <TableCell>{product.costPrice} LYD</TableCell>}
                    <TableCell>{product.sellingPrice} LYD</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{product.currentStock}</span>
                        {product.currentStock <= product.lowStockThreshold && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t("low")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} data-testid={`button-edit-${product.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteProductMutation.mutate(product.id)} data-testid={`button-delete-${product.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
