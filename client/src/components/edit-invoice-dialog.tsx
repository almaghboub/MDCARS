import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, Plus, Minus, Trash2, ArrowLeftRight } from "lucide-react";
import type { SaleWithDetails, ProductWithCategory } from "@shared/schema";

interface EditInvoiceDialogProps {
  sale: SaleWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NewCartItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  totalPrice: number;
  profit: number;
}

export function EditInvoiceDialog({ sale, open, onOpenChange }: EditInvoiceDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [returnItemIds, setReturnItemIds] = useState<Set<string>>(new Set());
  const [newItems, setNewItems] = useState<NewCartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products = [] } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products"],
  });

  const editMutation = useMutation({
    mutationFn: async (data: { returnItemIds: string[]; newItems: NewCartItem[] }) => {
      const res = await apiRequest("POST", `/api/sales/${sale.id}/edit`, {
        returnItemIds: data.returnItemIds,
        newItems: data.newItems.map(item => ({
          ...item,
          unitPrice: item.unitPrice.toFixed(2),
          costPrice: item.costPrice.toFixed(2),
          totalPrice: item.totalPrice.toFixed(2),
          profit: item.profit.toFixed(2),
        })),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goods-capital"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: t("invoiceEdited") });
      setReturnItemIds(new Set());
      setNewItems([]);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleReturnItem = (itemId: string) => {
    setReturnItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const addNewItem = (product: ProductWithCategory) => {
    const existing = newItems.find(i => i.productId === product.id);
    if (existing) {
      setNewItems(prev => prev.map(i =>
        i.productId === product.id
          ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice, profit: ((i.quantity + 1) * i.unitPrice) - ((i.quantity + 1) * i.costPrice) }
          : i
      ));
    } else {
      const unitPrice = parseFloat(product.sellingPrice);
      const costPrice = parseFloat(product.costPrice);
      setNewItems(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: 1,
        unitPrice,
        costPrice,
        totalPrice: unitPrice,
        profit: unitPrice - costPrice,
      }]);
    }
    setSearchQuery("");
  };

  const updateNewItemQty = (productId: string, delta: number) => {
    setNewItems(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, totalPrice: newQty * i.unitPrice, profit: (newQty * i.unitPrice) - (newQty * i.costPrice) };
    }));
  };

  const removeNewItem = (productId: string) => {
    setNewItems(prev => prev.filter(i => i.productId !== productId));
  };

  const filteredProducts = products.filter(p =>
    p.currentStock > 0 &&
    p.isActive &&
    !newItems.some(ni => ni.productId === p.id) &&
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const returnedTotal = sale.items
    .filter(item => returnItemIds.has(item.id))
    .reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);

  const newItemsTotal = newItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const priceDiff = newItemsTotal - returnedTotal;

  const handleSubmit = () => {
    if (returnItemIds.size === 0 && newItems.length === 0) return;
    editMutation.mutate({
      returnItemIds: Array.from(returnItemIds),
      newItems,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-edit-invoice-title">
            <ArrowLeftRight className="w-5 h-5" />
            {t("editInvoice")} - {sale.saleNumber}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t("editInvoiceDesc")}</p>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              {t("currentItems")}
              <Badge variant="outline">{sale.items.length}</Badge>
            </h3>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">{t("returnItems")}</TableHead>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead className="text-center">{t("quantity")}</TableHead>
                  <TableHead className="text-right">{t("totalPrice")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((item) => (
                  <TableRow
                    key={item.id}
                    className={returnItemIds.has(item.id) ? "bg-red-50 dark:bg-red-950/20 line-through opacity-60" : ""}
                    data-testid={`edit-item-${item.id}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={returnItemIds.has(item.id)}
                        onCheckedChange={() => toggleReturnItem(item.id)}
                        data-testid={`checkbox-return-${item.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">{parseFloat(item.totalPrice).toFixed(2)} {sale.currency}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {returnItemIds.size > 0 && (
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="p-3">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                    {t("returnItems")}: {returnItemIds.size} — {returnedTotal.toFixed(2)} {sale.currency}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              {t("addNewItems")}
              {newItems.length > 0 && <Badge variant="outline">{newItems.length}</Badge>}
            </h3>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchAndAddProducts")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-edit-search"
              />
            </div>

            {searchQuery && filteredProducts.length > 0 && (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {filteredProducts.slice(0, 8).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                    onClick={() => addNewItem(product)}
                    data-testid={`search-result-${product.id}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku} — {t("stock")}: {product.currentStock}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{product.sellingPrice} {sale.currency}</span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {newItems.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="text-center">{t("quantity")}</TableHead>
                    <TableHead className="text-right">{t("totalPrice")}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newItems.map((item) => (
                    <TableRow key={item.productId} className="bg-green-50 dark:bg-green-950/20" data-testid={`new-item-${item.productId}`}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateNewItemQty(item.productId, -1)} data-testid={`btn-minus-${item.productId}`}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateNewItemQty(item.productId, 1)} data-testid={`btn-plus-${item.productId}`}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.totalPrice.toFixed(2)} {sale.currency}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeNewItem(item.productId)} data-testid={`btn-remove-${item.productId}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {newItems.length > 0 && (
              <Card className="border-green-200 dark:border-green-800">
                <CardContent className="p-3">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    {t("newItemsToAdd")}: {newItems.length} — {newItemsTotal.toFixed(2)} {sale.currency}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {(returnItemIds.size > 0 || newItems.length > 0) && (
          <Card className={`mt-4 ${priceDiff > 0 ? 'border-orange-300' : priceDiff < 0 ? 'border-blue-300' : 'border-green-300'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("priceDifference")}</p>
                  <p className={`text-xl font-bold ${priceDiff > 0 ? 'text-orange-600' : priceDiff < 0 ? 'text-blue-600' : 'text-green-600'}`}>
                    {priceDiff > 0 ? `+${priceDiff.toFixed(2)}` : priceDiff.toFixed(2)} {sale.currency}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {priceDiff > 0 ? t("additionalCharge") : priceDiff < 0 ? t("refundToCustomer") : ""}
                  </p>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={editMutation.isPending || (returnItemIds.size === 0 && newItems.length === 0)}
                  className="min-w-32"
                  data-testid="button-save-edit"
                >
                  {editMutation.isPending ? t("processing") : t("saveChanges")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
