import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Boxes, Search, Plus, Minus, AlertTriangle, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react";
import type { ProductWithCategory, StockMovement } from "@shared/schema";
import { format } from "date-fns";

export default function Inventory() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockType, setStockType] = useState<"in" | "out" | "adjustment">("in");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [stockCost, setStockCost] = useState("");
  const { toast } = useToast();

  const { data: products = [], isLoading } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products"],
  });

  const { data: lowStockProducts = [] } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products/low-stock"],
  });

  const { data: movements = [] } = useQuery<StockMovement[]>({
    queryKey: ["/api/stock-movements"],
  });

  const stockMutation = useMutation({
    mutationFn: async ({ productId, type, quantity, reason, costPerUnit }: any) => {
      const res = await apiRequest("POST", `/api/products/${productId}/stock`, { type, quantity, reason, costPerUnit });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      toast({ title: t("stockUpdatedSuccessfully") || "Stock updated successfully" });
      setStockDialogOpen(false);
      setStockQuantity("");
      setStockReason("");
      setStockCost("");
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStockUpdate = () => {
    if (!selectedProduct || !stockQuantity) return;
    stockMutation.mutate({
      productId: selectedProduct.id,
      type: stockType,
      quantity: parseInt(stockQuantity),
      reason: stockReason,
      costPerUnit: stockCost || null,
    });
  };

  const openStockDialog = (product: ProductWithCategory, type: "in" | "out" | "adjustment") => {
    setSelectedProduct(product);
    setStockType(type);
    setStockCost(product.costPrice);
    setStockDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-inventory-title">{t("inventoryManagement")}</h1>
          <p className="text-muted-foreground">{t("trackStockMovements")}</p>
        </div>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">{t("stock")}</TabsTrigger>
          <TabsTrigger value="alerts">{t("lowStockAlert")} ({lowStockProducts.length})</TabsTrigger>
          <TabsTrigger value="movements">{t("stockMovements")}</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="w-5 h-5" />
                  {t("stock")}
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t("searchProducts")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-inventory"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>{t("loading")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("product")}</TableHead>
                      <TableHead>{t("sku")}</TableHead>
                      <TableHead>{t("category")}</TableHead>
                      <TableHead>{t("stock")}</TableHead>
                      <TableHead>Low Threshold</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id} data-testid={`inventory-row-${product.id}`}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell>{product.category?.name || "-"}</TableCell>
                        <TableCell className="font-bold">{product.currentStock}</TableCell>
                        <TableCell>{product.lowStockThreshold}</TableCell>
                        <TableCell>
                          {product.currentStock <= 0 ? (
                            <Badge variant="destructive">{t("outOfStock")}</Badge>
                          ) : product.currentStock <= product.lowStockThreshold ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              {t("low")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">In Stock</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openStockDialog(product, "in")}
                              title={t("stockIn")}
                              data-testid={`button-stock-in-${product.id}`}
                            >
                              <ArrowUpCircle className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openStockDialog(product, "out")}
                              title={t("stockOut")}
                              data-testid={`button-stock-out-${product.id}`}
                            >
                              <ArrowDownCircle className="w-4 h-4 text-red-500" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openStockDialog(product, "adjustment")}
                              title={t("adjustment")}
                              data-testid={`button-adjust-${product.id}`}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                {t("lowStockAlert")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("allWellStocked")}</p>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg" data-testid={`low-stock-alert-${product.id}`}>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{t("sku")}: {product.sku}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-destructive">{product.currentStock}</p>
                          <p className="text-sm text-muted-foreground">Threshold: {product.lowStockThreshold}</p>
                        </div>
                        <Button onClick={() => openStockDialog(product, "in")} data-testid={`button-restock-${product.id}`}>
                          <Plus className="w-4 h-4 mr-2" />
                          {t("stockIn")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("stockMovements")}</CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No stock movements recorded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("type")}</TableHead>
                      <TableHead>{t("quantity")}</TableHead>
                      <TableHead>{t("previousStock")}</TableHead>
                      <TableHead>{t("newStock")}</TableHead>
                      <TableHead>{t("reason")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.slice(0, 50).map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{format(new Date(movement.createdAt), "PPp")}</TableCell>
                        <TableCell>
                          <Badge variant={movement.type === "in" ? "default" : movement.type === "out" ? "destructive" : "secondary"}>
                            {movement.type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {movement.type === "in" ? "+" : movement.type === "out" ? "-" : ""}{movement.quantity}
                        </TableCell>
                        <TableCell>{movement.previousStock}</TableCell>
                        <TableCell>{movement.newStock}</TableCell>
                        <TableCell>{movement.reason || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {stockType === "in" ? t("stockIn") : stockType === "out" ? t("stockOut") : t("adjustment")}
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded">
                <p className="font-medium">{selectedProduct.name}</p>
                <p className="text-sm text-muted-foreground">{t("stock")}: {selectedProduct.currentStock}</p>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {stockType === "adjustment" ? "New Stock Level" : t("quantity")}
                </label>
                <Input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder={stockType === "adjustment" ? "Enter new stock level" : "Enter quantity"}
                  data-testid="input-stock-quantity"
                />
              </div>
              {stockType === "in" && (
                <div>
                  <label className="text-sm font-medium">Cost per Unit (LYD)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={stockCost}
                    onChange={(e) => setStockCost(e.target.value)}
                    data-testid="input-stock-cost"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">{t("reason")} (Optional)</label>
                <Input
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="Enter reason for stock change"
                  data-testid="input-stock-reason"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleStockUpdate}
                disabled={!stockQuantity || stockMutation.isPending}
                data-testid="button-update-stock"
              >
                {stockMutation.isPending ? "Updating..." : t("save")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
