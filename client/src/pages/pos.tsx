import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { ShoppingCart, Search, Plus, Minus, Trash2, User, Receipt, X, Printer } from "lucide-react";
import logoPath from "@assets/MD-removebg-preview_1770139105370.png";
import type { ProductWithCategory, Customer, SaleWithDetails } from "@shared/schema";

interface CartItem {
  product: ProductWithCategory;
  quantity: number;
  unitPrice: number;
  costPrice: number;
}

export default function POS() {
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [lastSale, setLastSale] = useState<SaleWithDetails | null>(null);
  const [lastCartItems, setLastCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "partial">("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [currency, setCurrency] = useState<"LYD" | "USD">("LYD");
  const [discount, setDiscount] = useState("0");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: products = [] } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      const res = await apiRequest("POST", "/api/sales", saleData);
      return res.json();
    },
    onSuccess: async (sale) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      toast({ title: t("saleCompleted"), description: `${t("invoiceNumber")}${sale.saleNumber}` });
      try {
        const res = await apiRequest("GET", `/api/sales/${sale.id}`);
        const fullSale = await res.json();
        setLastSale(fullSale);
        setLastCartItems([...cart]);
      } catch {
        setLastSale(sale);
      }
      setIsCheckoutDialogOpen(false);
      setIsReceiptDialogOpen(true);
      setCart([]);
      setSelectedCustomer(null);
      setAmountPaid("");
      setDiscount("0");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handlePrintReceipt = () => {
    if (!lastSale) return;
    const sale = lastSale;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemRows = sale.items?.map((item: any, i: number) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
        <td style="padding:10px 14px;font-size:12px;text-align:center;color:#94a3b8;border-bottom:1px solid #f1f5f9">${i + 1}</td>
        <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9">${item.productName}</td>
        <td style="padding:10px 14px;font-size:13px;text-align:center;border-bottom:1px solid #f1f5f9">${item.quantity}</td>
        <td style="padding:10px 14px;font-size:13px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9">${parseFloat(item.unitPrice).toFixed(2)} ${sale.currency}</td>
        <td style="padding:10px 14px;font-size:13px;text-align:right;font-weight:700;color:#1e293b;border-bottom:1px solid #f1f5f9">${parseFloat(item.totalPrice).toFixed(2)} ${sale.currency}</td>
      </tr>
    `).join('') || '';

    const discountRow = parseFloat(sale.discount) > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:10px 18px;font-size:13px;border-bottom:1px solid #f1f5f9">
        <span style="color:#64748b">${t("discount")}</span>
        <span style="font-weight:600;color:#ef4444">-${parseFloat(sale.discount).toFixed(2)} ${sale.currency}</span>
      </div>` : '';

    const dueRow = parseFloat(sale.amountDue) > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:10px 18px;font-size:13px">
        <span style="color:#64748b">${t("amountDue")}</span>
        <span style="font-weight:700;color:#ea580c">${parseFloat(sale.amountDue).toFixed(2)} ${sale.currency}</span>
      </div>` : '';

    const changeAmount = parseFloat(sale.amountPaid) - parseFloat(sale.totalAmount);
    const changeRow = changeAmount > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:10px 18px;font-size:13px">
        <span style="color:#64748b">${t("change")}</span>
        <span style="font-weight:700;color:#16a34a">${changeAmount.toFixed(2)} ${sale.currency}</span>
      </div>` : '';

    const statusStyle = sale.status === 'completed' ? 'background:#dcfce7;color:#166534' : sale.status === 'returned' ? 'background:#fecaca;color:#991b1b' : 'background:#fef3c7;color:#92400e';
    const statusLabel = sale.status === 'completed' ? t("completed") : sale.status === 'returned' ? t("returned") : t("pending");
    const dateStr = new Date(sale.createdAt).toLocaleDateString() + ' ' + new Date(sale.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

    const logoUrl = new URL(logoPath, window.location.origin).href;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice ${sale.saleNumber} - MD CARS</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; color:#1a1a2e; background:white; }
      @media print { body { padding:0; margin:0; } @page { margin:0.4in; size:A4; } }
    </style></head><body>
    <div style="max-width:800px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#1e3a5f 0%,#0f2341 100%);color:white;padding:28px 32px;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:14px">
          <img src="${logoUrl}" alt="MD Cars" style="height:60px;filter:brightness(1.2)" />
          <div>
            <h1 style="font-size:26px;font-weight:900;letter-spacing:3px;color:#fff">MD CARS</h1>
            <p style="font-size:11px;color:#93c5fd;letter-spacing:2px;text-transform:uppercase;margin-top:2px">Car Accessories & Parts</p>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:28px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#60a5fa">${t("invoice")}</div>
          <div style="font-size:13px;color:#93c5fd;margin-top:4px;font-weight:500">${sale.saleNumber}</div>
          <div style="margin-top:8px"><span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;${statusStyle}">${statusLabel}</span></div>
        </div>
      </div>
      <div style="height:4px;background:linear-gradient(90deg,#2563eb,#60a5fa,#2563eb)"></div>

      <div style="padding:24px 32px">
        <div style="display:flex;gap:18px;margin-bottom:22px">
          <div style="flex:1;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
            <div style="background:#f0f4ff;padding:9px 14px;border-bottom:1px solid #e2e8f0">
              <h4 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1e3a5f">${t("invoiceDetails")}</h4>
            </div>
            <div style="padding:12px 14px">
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span style="color:#64748b">${t("date")}</span><span style="font-weight:600;color:#1e293b">${dateStr}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span style="color:#64748b">${t("paymentMethod")}</span><span style="font-weight:600;color:#1e293b">${sale.paymentMethod === 'cash' ? t("cash") : t("partial")}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span style="color:#64748b">${t("currency")}</span><span style="font-weight:600;color:#1e293b">${sale.currency}</span></div>
            </div>
          </div>
          <div style="flex:1;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
            <div style="background:#f0f4ff;padding:9px 14px;border-bottom:1px solid #e2e8f0">
              <h4 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1e3a5f">${t("customerInfo")}</h4>
            </div>
            <div style="padding:12px 14px">
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span style="color:#64748b">${t("customer")}</span><span style="font-weight:600;color:#1e293b">${sale.customer?.name || t("walkin")}</span></div>
              ${sale.customer?.phone ? `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span style="color:#64748b">${t("phone")}</span><span style="font-weight:600;color:#1e293b">${sale.customer.phone}</span></div>` : ''}
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span style="color:#64748b">${t("soldBy")}</span><span style="font-weight:600;color:#1e293b">${sale.createdBy?.firstName || ''} ${sale.createdBy?.lastName || ''}</span></div>
            </div>
          </div>
        </div>

        <div style="margin-bottom:22px">
          <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
            <thead>
              <tr>
                <th style="background:linear-gradient(135deg,#1e3a5f,#0f2341);color:white;padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:center;width:36px">#</th>
                <th style="background:linear-gradient(135deg,#1e3a5f,#0f2341);color:white;padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:left">${t("product")}</th>
                <th style="background:linear-gradient(135deg,#1e3a5f,#0f2341);color:white;padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:center">${t("quantity")}</th>
                <th style="background:linear-gradient(135deg,#1e3a5f,#0f2341);color:white;padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:right">${t("unitPrice")}</th>
                <th style="background:linear-gradient(135deg,#1e3a5f,#0f2341);color:white;padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:right">${t("totalPrice")}</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-bottom:22px">
          <div style="width:300px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
            <div style="display:flex;justify-content:space-between;padding:10px 18px;font-size:13px;border-bottom:1px solid #f1f5f9">
              <span style="color:#64748b">${t("subtotal")}</span>
              <span style="font-weight:600">${parseFloat(sale.subtotal).toFixed(2)} ${sale.currency}</span>
            </div>
            ${discountRow}
            <div style="display:flex;justify-content:space-between;padding:14px 18px;background:linear-gradient(135deg,#1e3a5f,#0f2341)">
              <span style="color:#93c5fd;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:1px">${t("total")}</span>
              <span style="color:#fff;font-weight:900;font-size:18px">${parseFloat(sale.totalAmount).toFixed(2)} ${sale.currency}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 18px;font-size:13px;border-bottom:1px solid #f1f5f9">
              <span style="color:#64748b">${t("paid")}</span>
              <span style="font-weight:700;color:#16a34a">${parseFloat(sale.amountPaid).toFixed(2)} ${sale.currency}</span>
            </div>
            ${dueRow}
            ${changeRow}
          </div>
        </div>
      </div>

      <div style="text-align:center;padding:18px 32px;border-top:1px solid #e2e8f0;background:#f8fafc">
        <p style="font-size:16px;font-weight:800;color:#1e3a5f;margin-bottom:4px">${t("thankYou")}</p>
        <p style="font-size:12px;color:#64748b;letter-spacing:1px">MD CARS - Car Accessories & Parts</p>
        <div style="width:60px;height:3px;background:linear-gradient(90deg,#2563eb,#60a5fa);margin:10px auto 0;border-radius:2px"></div>
      </div>
    </div>
    <script>setTimeout(function(){window.print();window.close();},400);</script>
    </body></html>`);
    printWindow.document.close();
  };

  const createCustomerMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string }) => {
      const res = await apiRequest("POST", "/api/customers", data);
      return res.json();
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedCustomer(customer);
      setIsCustomerDialogOpen(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      toast({ title: t("customerCreated") });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredProducts = products.filter(p =>
    p.isActive &&
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchQuery)))
  );

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  const addToCart = (product: ProductWithCategory) => {
    if (product.currentStock <= 0) {
      toast({ title: t("outOfStock"), variant: "destructive" });
      return;
    }
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.currentStock) {
        toast({ title: t("notEnoughStock"), variant: "destructive" });
        return;
      }
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        unitPrice: parseFloat(product.sellingPrice),
        costPrice: parseFloat(product.costPrice),
      }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.product.currentStock) {
          toast({ title: t("notEnoughStock"), variant: "destructive" });
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }, [cart]);

  const discountAmount = parseFloat(discount) || 0;
  const total = subtotal - discountAmount;
  const paid = parseFloat(amountPaid) || 0;
  const amountDue = Math.max(0, total - paid);

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({ title: t("cartIsEmpty"), variant: "destructive" });
      return;
    }
    if (paid <= 0) {
      toast({ title: "Please enter amount paid", variant: "destructive" });
      return;
    }

    const items = cart.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      productSku: item.product.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      costPrice: item.costPrice.toFixed(2),
      totalPrice: (item.unitPrice * item.quantity).toFixed(2),
      profit: ((item.unitPrice - item.costPrice) * item.quantity).toFixed(2),
    }));

    createSaleMutation.mutate({
      sale: {
        customerId: selectedCustomer?.id || null,
        subtotal: subtotal.toFixed(2),
        discount: discountAmount.toFixed(2),
        totalAmount: total.toFixed(2),
        amountPaid: paid.toFixed(2),
        amountDue: amountDue.toFixed(2),
        paymentMethod: paid >= total ? "cash" : "partial",
        currency,
      },
      items,
    });
  };

  return (
    <div className="p-6 h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" data-testid="text-pos-title">{t("pointOfSale")}</h1>
        {selectedCustomer ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {selectedCustomer.name}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setIsCustomerDialogOpen(true)} data-testid="button-select-customer">
            <User className="w-4 h-4 mr-2" />
            {t("selectCustomer")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-4rem)]">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("searchByNameSkuBarcode")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-lg py-6"
              data-testid="input-pos-search"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-auto max-h-[calc(100vh-16rem)]">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className={`cursor-pointer transition-all hover:shadow-md ${product.currentStock <= 0 ? 'opacity-50' : ''}`}
                onClick={() => addToCart(product)}
                data-testid={`product-card-${product.id}`}
              >
                <CardContent className="p-4">
                  <h3 className="font-medium truncate">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">{product.sku}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-bold text-primary">{product.sellingPrice} LYD</span>
                    <Badge variant={product.currentStock > product.lowStockThreshold ? "secondary" : "destructive"}>
                      {product.currentStock}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {t("cart")} ({cart.length} {t("items")})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto">
              {cart.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("cartIsEmpty")}</p>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between p-2 bg-muted rounded" data-testid={`cart-item-${item.product.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">{item.unitPrice.toFixed(2)} LYD x {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromCart(item.product.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-4 mt-4 space-y-2">
              <div className="flex justify-between">
                <span>{t("subtotal")}:</span>
                <span className="font-medium">{subtotal.toFixed(2)} LYD</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t("discount")}:</span>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-24 text-right"
                  data-testid="input-discount"
                />
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>{t("total")}:</span>
                <span data-testid="text-cart-total">{total.toFixed(2)} LYD</span>
              </div>
              <Button
                className="w-full mt-4"
                size="lg"
                disabled={cart.length === 0}
                onClick={() => {
                  setAmountPaid(total.toFixed(2));
                  setIsCheckoutDialogOpen(true);
                }}
                data-testid="button-checkout"
              >
                <Receipt className="w-4 h-4 mr-2" />
                {t("checkout")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("selectOrCreateCustomer")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={t("searchCustomers")}
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              data-testid="input-customer-search"
            />
            <div className="max-h-48 overflow-auto space-y-2">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="p-3 bg-muted rounded cursor-pointer hover:bg-accent"
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setIsCustomerDialogOpen(false);
                  }}
                  data-testid={`customer-option-${customer.id}`}
                >
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                </div>
              ))}
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">{t("createNewCustomer")}</h4>
              <div className="space-y-2">
                <Input placeholder={t("name")} value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} data-testid="input-new-customer-name" />
                <Input placeholder={t("phone")} value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} data-testid="input-new-customer-phone" />
                <Button
                  className="w-full"
                  onClick={() => createCustomerMutation.mutate({ name: newCustomerName, phone: newCustomerPhone })}
                  disabled={!newCustomerName || !newCustomerPhone || createCustomerMutation.isPending}
                  data-testid="button-create-customer"
                >
                  {t("createCustomer")}
                </Button>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setIsCustomerDialogOpen(false)}>
              {t("continueAsWalkin")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("completeSale")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded space-y-2">
              <div className="flex justify-between"><span>{t("subtotal")}:</span><span>{subtotal.toFixed(2)} LYD</span></div>
              <div className="flex justify-between"><span>{t("discount")}:</span><span>-{discountAmount.toFixed(2)} LYD</span></div>
              <div className="flex justify-between text-lg font-bold"><span>{t("total")}:</span><span>{total.toFixed(2)} LYD</span></div>
            </div>
            <div>
              <label className="text-sm font-medium">{t("currency")}</label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "LYD" | "USD")}>
                <SelectTrigger data-testid="select-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LYD">LYD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("amountPaid")}</label>
              <Input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="text-lg"
                data-testid="input-amount-paid"
              />
            </div>
            {amountDue > 0 && (
              <div className="p-3 bg-destructive/10 rounded">
                <p className="text-destructive font-medium">{t("amountDue")}: {amountDue.toFixed(2)} LYD</p>
                <p className="text-sm text-muted-foreground">{t("addedToCustomerBalance")}</p>
              </div>
            )}
            {paid > total && (
              <div className="p-3 bg-green-500/10 rounded">
                <p className="text-green-600 font-medium">{t("change")}: {(paid - total).toFixed(2)} LYD</p>
              </div>
            )}
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={createSaleMutation.isPending}
              data-testid="button-complete-sale"
            >
              {createSaleMutation.isPending ? t("processing") : t("completeSale")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("invoiceReceipt")}</DialogTitle>
          </DialogHeader>
          {lastSale && (
            <>
              <div ref={receiptRef}>
                <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%)", color: "white", padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <img src={logoPath} alt="MD Cars" style={{ height: "55px", filter: "brightness(1.2)" }} />
                    <div>
                      <h1 style={{ fontSize: "24px", fontWeight: 900, letterSpacing: "3px", color: "#fff", margin: 0 }}>MD CARS</h1>
                      <p style={{ fontSize: "10px", color: "#93c5fd", letterSpacing: "2px", textTransform: "uppercase", marginTop: "2px" }}>Car Accessories & Parts</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "24px", fontWeight: 900, letterSpacing: "3px", textTransform: "uppercase", color: "#60a5fa" }}>{t("invoice")}</div>
                    <div style={{ fontSize: "12px", color: "#93c5fd", marginTop: "3px" }} data-testid="text-receipt-number">{lastSale.saleNumber}</div>
                    <div style={{ marginTop: "6px" }}>
                      <span style={{
                        display: "inline-block", padding: "4px 12px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
                        ...(lastSale.status === "completed" ? { background: "#dcfce7", color: "#166534" } : lastSale.status === "returned" ? { background: "#fecaca", color: "#991b1b" } : { background: "#fef3c7", color: "#92400e" })
                      }}>
                        {lastSale.status === "completed" ? t("completed") : lastSale.status === "returned" ? t("returned") : t("pending")}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ height: "3px", background: "linear-gradient(90deg, #2563eb, #60a5fa, #2563eb)" }} />

                <div style={{ padding: "20px 28px" }}>
                  <div style={{ display: "flex", gap: "16px", marginBottom: "18px" }}>
                    <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                      <div style={{ background: "#f0f4ff", padding: "8px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        <h4 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#1e3a5f", margin: 0 }}>{t("invoiceDetails")}</h4>
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}>
                          <span style={{ color: "#64748b" }}>{t("date")}</span>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{new Date(lastSale.createdAt).toLocaleDateString()} {new Date(lastSale.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}>
                          <span style={{ color: "#64748b" }}>{t("paymentMethod")}</span>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{lastSale.paymentMethod === "cash" ? t("cash") : t("partial")}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}>
                          <span style={{ color: "#64748b" }}>{t("currency")}</span>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{lastSale.currency}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                      <div style={{ background: "#f0f4ff", padding: "8px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        <h4 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#1e3a5f", margin: 0 }}>{t("customerInfo")}</h4>
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}>
                          <span style={{ color: "#64748b" }}>{t("customer")}</span>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{lastSale.customer?.name || t("walkin")}</span>
                        </div>
                        {lastSale.customer?.phone && (
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}>
                            <span style={{ color: "#64748b" }}>{t("phone")}</span>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>{lastSale.customer.phone}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}>
                          <span style={{ color: "#64748b" }}>{t("soldBy")}</span>
                          <span style={{ fontWeight: 600, color: "#1e293b" }} data-testid="text-receipt-seller">{lastSale.createdBy?.firstName} {lastSale.createdBy?.lastName}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", borderRadius: "8px", overflow: "hidden", border: "1px solid #e2e8f0", marginBottom: "18px" }}>
                    <thead>
                      <tr>
                        <th style={{ background: "linear-gradient(135deg, #1e3a5f, #0f2341)", color: "white", padding: "10px 12px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", textAlign: "center", width: "32px" }}>#</th>
                        <th style={{ background: "linear-gradient(135deg, #1e3a5f, #0f2341)", color: "white", padding: "10px 12px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", textAlign: "left" }}>{t("product")}</th>
                        <th style={{ background: "linear-gradient(135deg, #1e3a5f, #0f2341)", color: "white", padding: "10px 12px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", textAlign: "center" }}>{t("quantity")}</th>
                        <th style={{ background: "linear-gradient(135deg, #1e3a5f, #0f2341)", color: "white", padding: "10px 12px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", textAlign: "right" }}>{t("unitPrice")}</th>
                        <th style={{ background: "linear-gradient(135deg, #1e3a5f, #0f2341)", color: "white", padding: "10px 12px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", textAlign: "right" }}>{t("totalPrice")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastSale.items?.map((item: any, idx: number) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                          <td style={{ padding: "9px 12px", fontSize: "11px", textAlign: "center", color: "#94a3b8", borderBottom: "1px solid #f1f5f9" }}>{idx + 1}</td>
                          <td style={{ padding: "9px 12px", fontSize: "12px", fontWeight: 600, color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}>{item.productName}</td>
                          <td style={{ padding: "9px 12px", fontSize: "12px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>{item.quantity}</td>
                          <td style={{ padding: "9px 12px", fontSize: "12px", textAlign: "right", color: "#475569", borderBottom: "1px solid #f1f5f9" }}>{parseFloat(item.unitPrice).toFixed(2)} {lastSale.currency}</td>
                          <td style={{ padding: "9px 12px", fontSize: "12px", textAlign: "right", fontWeight: 700, color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}>{parseFloat(item.totalPrice).toFixed(2)} {lastSale.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "18px" }}>
                    <div style={{ width: "280px", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 16px", fontSize: "12px", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ color: "#64748b" }}>{t("subtotal")}</span>
                        <span style={{ fontWeight: 600 }}>{parseFloat(lastSale.subtotal).toFixed(2)} {lastSale.currency}</span>
                      </div>
                      {parseFloat(lastSale.discount) > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 16px", fontSize: "12px", borderBottom: "1px solid #f1f5f9" }}>
                          <span style={{ color: "#64748b" }}>{t("discount")}</span>
                          <span style={{ fontWeight: 600, color: "#ef4444" }}>-{parseFloat(lastSale.discount).toFixed(2)} {lastSale.currency}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "linear-gradient(135deg, #1e3a5f, #0f2341)" }}>
                        <span style={{ color: "#93c5fd", fontWeight: 700, fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px" }}>{t("total")}</span>
                        <span style={{ color: "#fff", fontWeight: 900, fontSize: "16px" }}>{parseFloat(lastSale.totalAmount).toFixed(2)} {lastSale.currency}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 16px", fontSize: "12px", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ color: "#64748b" }}>{t("paid")}</span>
                        <span style={{ fontWeight: 700, color: "#16a34a" }}>{parseFloat(lastSale.amountPaid).toFixed(2)} {lastSale.currency}</span>
                      </div>
                      {parseFloat(lastSale.amountDue) > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 16px", fontSize: "12px" }}>
                          <span style={{ color: "#64748b" }}>{t("amountDue")}</span>
                          <span style={{ fontWeight: 700, color: "#ea580c" }}>{parseFloat(lastSale.amountDue).toFixed(2)} {lastSale.currency}</span>
                        </div>
                      )}
                      {parseFloat(lastSale.amountPaid) > parseFloat(lastSale.totalAmount) && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 16px", fontSize: "12px" }}>
                          <span style={{ color: "#64748b" }}>{t("change")}</span>
                          <span style={{ fontWeight: 700, color: "#16a34a" }}>{(parseFloat(lastSale.amountPaid) - parseFloat(lastSale.totalAmount)).toFixed(2)} {lastSale.currency}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "center", padding: "16px 28px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <p style={{ fontSize: "14px", fontWeight: 800, color: "#1e3a5f", marginBottom: "3px" }}>{t("thankYou")}</p>
                  <p style={{ fontSize: "11px", color: "#64748b", letterSpacing: "1px", margin: 0 }}>MD CARS - Car Accessories & Parts</p>
                  <div style={{ width: "50px", height: "3px", background: "linear-gradient(90deg, #2563eb, #60a5fa)", margin: "8px auto 0", borderRadius: "2px" }} />
                </div>
              </div>

              <div className="flex gap-2 p-4 border-t">
                <Button onClick={handlePrintReceipt} className="flex-1" data-testid="button-print-receipt">
                  <Printer className="w-4 h-4 mr-2" />
                  {t("printInvoice")}
                </Button>
                <Button variant="outline" onClick={() => setIsReceiptDialogOpen(false)} className="flex-1" data-testid="button-close-receipt">
                  {t("close")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
