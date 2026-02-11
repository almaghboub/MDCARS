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
      toast({ title: "Sale completed!", description: `Invoice #${sale.saleNumber}` });
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
    if (receiptRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Invoice - MD CARS</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 6px 4px; text-align: left; border-bottom: 1px solid #ddd; font-size: 13px; }
            th { font-weight: bold; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .border-top { border-top: 2px solid #000; }
            .mb { margin-bottom: 10px; }
            .mt { margin-top: 10px; }
            h2 { margin: 5px 0; }
            p { margin: 3px 0; font-size: 13px; }
            .logo { text-align: center; margin-bottom: 10px; }
            .logo img { height: 60px; }
            @media print { body { padding: 0; } }
          </style></head><body>
          ${receiptRef.current.innerHTML}
          <script>window.print(); window.close();</script>
          </body></html>
        `);
        printWindow.document.close();
      }
    }
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
      toast({ title: "Customer created" });
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
      toast({ title: "Out of stock", variant: "destructive" });
      return;
    }
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.currentStock) {
        toast({ title: "Not enough stock", variant: "destructive" });
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
          toast({ title: "Not enough stock", variant: "destructive" });
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
      toast({ title: "Cart is empty", variant: "destructive" });
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
        <h1 className="text-2xl font-bold" data-testid="text-pos-title">Point of Sale</h1>
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
            Select Customer
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-4rem)]">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, or barcode..."
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
              Cart ({cart.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto">
              {cart.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Cart is empty</p>
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
                <span>Subtotal:</span>
                <span className="font-medium">{subtotal.toFixed(2)} LYD</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Discount:</span>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-24 text-right"
                  data-testid="input-discount"
                />
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
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
                Checkout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select or Create Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search customers..."
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
              <h4 className="font-medium mb-2">Create New Customer</h4>
              <div className="space-y-2">
                <Input placeholder="Name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} data-testid="input-new-customer-name" />
                <Input placeholder="Phone" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} data-testid="input-new-customer-phone" />
                <Button
                  className="w-full"
                  onClick={() => createCustomerMutation.mutate({ name: newCustomerName, phone: newCustomerPhone })}
                  disabled={!newCustomerName || !newCustomerPhone || createCustomerMutation.isPending}
                  data-testid="button-create-customer"
                >
                  Create Customer
                </Button>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setIsCustomerDialogOpen(false)}>
              Continue as Walk-in
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded space-y-2">
              <div className="flex justify-between"><span>Subtotal:</span><span>{subtotal.toFixed(2)} LYD</span></div>
              <div className="flex justify-between"><span>Discount:</span><span>-{discountAmount.toFixed(2)} LYD</span></div>
              <div className="flex justify-between text-lg font-bold"><span>Total:</span><span>{total.toFixed(2)} LYD</span></div>
            </div>
            <div>
              <label className="text-sm font-medium">Currency</label>
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
              <label className="text-sm font-medium">Amount Paid</label>
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
                <p className="text-destructive font-medium">Amount Due: {amountDue.toFixed(2)} LYD</p>
                <p className="text-sm text-muted-foreground">This will be added to customer's balance</p>
              </div>
            )}
            {paid > total && (
              <div className="p-3 bg-green-500/10 rounded">
                <p className="text-green-600 font-medium">Change: {(paid - total).toFixed(2)} LYD</p>
              </div>
            )}
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={createSaleMutation.isPending}
              data-testid="button-complete-sale"
            >
              {createSaleMutation.isPending ? "Processing..." : "Complete Sale"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice / Receipt</DialogTitle>
          </DialogHeader>
          {lastSale && (
            <>
              <div ref={receiptRef} className="space-y-3 text-sm">
                <div className="text-center border-b pb-3">
                  <div className="logo">
                    <img src={logoPath} alt="MD Cars" className="h-14 mx-auto" />
                  </div>
                  <h2 className="text-lg font-bold">MD CARS</h2>
                  <p className="text-muted-foreground text-xs">Car Accessories</p>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice #:</span>
                    <span className="font-bold" data-testid="text-receipt-number">{lastSale.saleNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{new Date(lastSale.createdAt).toLocaleDateString()} {new Date(lastSale.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sold by:</span>
                    <span className="font-medium" data-testid="text-receipt-seller">
                      {lastSale.createdBy?.firstName} {lastSale.createdBy?.lastName}
                    </span>
                  </div>
                  {lastSale.customer && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer:</span>
                      <span>{lastSale.customer.name}</span>
                    </div>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-xs text-center">Qty</TableHead>
                      <TableHead className="text-xs text-right">Price</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lastSale.items?.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs py-1">{item.productName}</TableCell>
                        <TableCell className="text-xs text-center py-1">{item.quantity}</TableCell>
                        <TableCell className="text-xs text-right py-1">{parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right py-1">{parseFloat(item.totalPrice).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{parseFloat(lastSale.subtotal).toFixed(2)} {lastSale.currency}</span>
                  </div>
                  {parseFloat(lastSale.discount) > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Discount:</span>
                      <span>-{parseFloat(lastSale.discount).toFixed(2)} {lastSale.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t pt-1">
                    <span>Total:</span>
                    <span>{parseFloat(lastSale.totalAmount).toFixed(2)} {lastSale.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paid:</span>
                    <span>{parseFloat(lastSale.amountPaid).toFixed(2)} {lastSale.currency}</span>
                  </div>
                  {parseFloat(lastSale.amountDue) > 0 && (
                    <div className="flex justify-between text-destructive font-medium">
                      <span>Amount Due:</span>
                      <span>{parseFloat(lastSale.amountDue).toFixed(2)} {lastSale.currency}</span>
                    </div>
                  )}
                  {parseFloat(lastSale.amountPaid) > parseFloat(lastSale.totalAmount) && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Change:</span>
                      <span>{(parseFloat(lastSale.amountPaid) - parseFloat(lastSale.totalAmount)).toFixed(2)} {lastSale.currency}</span>
                    </div>
                  )}
                </div>

                <div className="text-center border-t pt-2 text-xs text-muted-foreground">
                  <p>Thank you for your purchase!</p>
                  <p>MD CARS - Car Accessories</p>
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <Button onClick={handlePrintReceipt} className="flex-1" data-testid="button-print-receipt">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Invoice
                </Button>
                <Button variant="outline" onClick={() => setIsReceiptDialogOpen(false)} className="flex-1" data-testid="button-close-receipt">
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
