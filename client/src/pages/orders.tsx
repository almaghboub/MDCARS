import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import type { OrderWithItems, OrderItem, Customer } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag, Plus, Search, Eye, Pencil, Trash2, Package, Truck, CheckCircle, XCircle, Clock } from "lucide-react";

type OrderItemForm = {
  productName: string;
  quantity: number;
  price: string;
  cost: string;
  weight: string;
};

type OrderForm = {
  customerId: string;
  receiverName: string;
  receiverPhone: string;
  shippingCountry: string;
  shippingCity: string;
  shippingCategory: string;
  shippingCost: string;
  shippingWeight: string;
  downPayment: string;
  downPaymentType: string;
  lydExchangeRate: string;
  status: string;
  notes: string;
  items: OrderItemForm[];
};

const emptyForm: OrderForm = {
  customerId: "",
  receiverName: "",
  receiverPhone: "",
  shippingCountry: "Libya",
  shippingCity: "",
  shippingCategory: "normal",
  shippingCost: "0",
  shippingWeight: "0",
  downPayment: "0",
  downPaymentType: "",
  lydExchangeRate: "1",
  status: "pending",
  notes: "",
  items: [{ productName: "", quantity: 1, price: "0", cost: "0", weight: "0" }],
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  shipped: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  partially_arrived: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  ready_to_collect: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
};

const STATUSES = ["pending", "processing", "shipped", "delivered", "completed", "cancelled", "partially_arrived", "ready_to_collect"];
const COUNTRIES = ["Libya", "China", "Turkey", "UK", "UAE", "Germany", "USA"];

function getStatusLabel(status: string, t: any): string {
  const map: Record<string, string> = {
    pending: t("pending") || "Pending",
    processing: t("processing") || "Processing",
    shipped: t("shipped") || "Shipped",
    delivered: t("delivered") || "Delivered",
    completed: t("statusCompleted") || "Completed",
    cancelled: t("statusCancelled") || "Cancelled",
    partially_arrived: t("statusPartiallyArrived") || "Partially Arrived",
    ready_to_collect: t("statusReadyToCollect") || "Ready to Collect",
  };
  return map[status] || status;
}

function OrderFormModal({
  open,
  onClose,
  editOrder,
  customers,
}: {
  open: boolean;
  onClose: () => void;
  editOrder: OrderWithItems | null;
  customers: Customer[];
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [form, setForm] = useState<OrderForm>(() =>
    editOrder
      ? {
          customerId: editOrder.customerId || "",
          receiverName: editOrder.receiverName,
          receiverPhone: editOrder.receiverPhone,
          shippingCountry: editOrder.shippingCountry,
          shippingCity: editOrder.shippingCity,
          shippingCategory: editOrder.shippingCategory,
          shippingCost: editOrder.shippingCost,
          shippingWeight: editOrder.shippingWeight,
          downPayment: editOrder.downPayment,
          downPaymentType: editOrder.downPaymentType || "",
          lydExchangeRate: editOrder.lydExchangeRate,
          status: editOrder.status,
          notes: editOrder.notes || "",
          items: editOrder.items.length > 0
            ? editOrder.items.map((it) => ({
                productName: it.productName,
                quantity: it.quantity,
                price: it.price,
                cost: it.cost,
                weight: it.weight,
              }))
            : [{ productName: "", quantity: 1, price: "0", cost: "0", weight: "0" }],
        }
      : { ...emptyForm }
  );

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: t("success") || "Success", description: t("orderCreatedSuccess") || "Order created successfully" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: t("error") || "Error", description: err.message || t("failedCreateOrder"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/orders/${editOrder?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: t("success") || "Success", description: t("orderUpdatedSuccess") || "Order updated successfully" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: t("error") || "Error", description: err.message || t("failedUpdateOrder"), variant: "destructive" });
    },
  });

  const totalAmount = form.items.reduce((sum, it) => sum + parseFloat(it.price || "0") * (it.quantity || 1), 0);
  const shippingCost = parseFloat(form.shippingCost || "0");
  const downPayment = parseFloat(form.downPayment || "0");
  const remaining = totalAmount + shippingCost - downPayment;

  function updateItem(index: number, field: keyof OrderItemForm, value: any) {
    setForm((f) => {
      const items = [...f.items];
      items[index] = { ...items[index], [field]: value };
      return { ...f, items };
    });
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { productName: "", quantity: 1, price: "0", cost: "0", weight: "0" }] }));
  }

  function removeItem(index: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  function handleSubmit() {
    if (!form.receiverName || !form.receiverPhone || !form.shippingCity) {
      toast({ title: t("validationError") || "Validation Error", description: "Receiver name, phone, and city are required.", variant: "destructive" });
      return;
    }
    if (form.items.some((it) => !it.productName)) {
      toast({ title: t("validationError") || "Validation Error", description: "All items must have a product name.", variant: "destructive" });
      return;
    }
    const payload = {
      customerId: form.customerId || null,
      receiverName: form.receiverName,
      receiverPhone: form.receiverPhone,
      shippingCountry: form.shippingCountry,
      shippingCity: form.shippingCity,
      shippingCategory: form.shippingCategory,
      shippingCost: form.shippingCost,
      shippingWeight: form.shippingWeight,
      downPayment: form.downPayment,
      downPaymentType: form.downPaymentType || null,
      lydExchangeRate: form.lydExchangeRate,
      status: form.status,
      notes: form.notes || null,
      items: form.items.map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        price: it.price,
        cost: it.cost,
        weight: it.weight,
      })),
    };
    if (editOrder) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editOrder ? (t("editOrderTitle") || "Edit Order") : (t("createNewOrder") || "Create New Order")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer (optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>{t("selectCustomer") || "Customer (Optional)"}</Label>
              <Select value={form.customerId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v === "none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCustomer") || "Select customer..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— {t("walkIn") || "No Customer"} —</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Receiver info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("fullNameRequired") || "Receiver Name *"}</Label>
              <Input value={form.receiverName} onChange={(e) => setForm((f) => ({ ...f, receiverName: e.target.value }))} placeholder={t("enterFullName") || "Enter full name"} />
            </div>
            <div>
              <Label>{t("phoneRequired") || "Receiver Phone *"}</Label>
              <Input value={form.receiverPhone} onChange={(e) => setForm((f) => ({ ...f, receiverPhone: e.target.value }))} placeholder={t("enterPhoneNumber") || "Enter phone"} />
            </div>
          </div>

          {/* Shipping details */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>{t("shippingCountry") || "Country"}</Label>
              <Select value={form.shippingCountry} onValueChange={(v) => setForm((f) => ({ ...f, shippingCountry: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("shippingCity") || "City *"}</Label>
              <Input value={form.shippingCity} onChange={(e) => setForm((f) => ({ ...f, shippingCity: e.target.value }))} placeholder={t("enterCity") || "Enter city"} />
            </div>
            <div>
              <Label>{t("shippingCategory") || "Category"}</Label>
              <Select value={form.shippingCategory} onValueChange={(v) => setForm((f) => ({ ...f, shippingCategory: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{t("normalShipping") || "Normal"}</SelectItem>
                  <SelectItem value="express">{t("expressShipping") || "Express"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>{t("shippingCost") || "Shipping Cost ($)"}</Label>
              <Input type="number" step="0.01" value={form.shippingCost} onChange={(e) => setForm((f) => ({ ...f, shippingCost: e.target.value }))} />
            </div>
            <div>
              <Label>{t("shippingWeightKg") || "Weight (kg)"}</Label>
              <Input type="number" step="0.01" value={form.shippingWeight} onChange={(e) => setForm((f) => ({ ...f, shippingWeight: e.target.value }))} />
            </div>
            <div>
              <Label>{t("lydExchangeRate") || "LYD Rate"}</Label>
              <Input type="number" step="0.01" value={form.lydExchangeRate} onChange={(e) => setForm((f) => ({ ...f, lydExchangeRate: e.target.value }))} />
            </div>
          </div>

          {/* Down payment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("downPaymentOptional") || "Down Payment ($)"}</Label>
              <Input type="number" step="0.01" value={form.downPayment} onChange={(e) => setForm((f) => ({ ...f, downPayment: e.target.value }))} />
            </div>
            <div>
              <Label>{t("paymentMethod") || "Down Payment Type"}</Label>
              <Select value={form.downPaymentType || "none"} onValueChange={(v) => setForm((f) => ({ ...f, downPaymentType: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status (edit only) */}
          {editOrder && (
            <div>
              <Label>{t("orderStatus") || "Status"}</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{getStatusLabel(s, t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Items */}
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">{t("orderItems") || "Order Items"}</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> {t("addItem") || "Add Item"}
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 border rounded">
                  <div className="col-span-4">
                    <Input
                      placeholder={t("productNameNumber") || "Product name"}
                      value={item.productName}
                      onChange={(e) => updateItem(idx, "productName", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number" min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number" step="0.01"
                      placeholder={t("unitPriceDollar") || "Price $"}
                      value={item.price}
                      onChange={(e) => updateItem(idx, "price", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number" step="0.01"
                      placeholder={t("costPrice") || "Cost $"}
                      value={item.cost}
                      onChange={(e) => updateItem(idx, "cost", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number" step="0.001"
                      placeholder="Weight kg"
                      value={item.weight}
                      onChange={(e) => updateItem(idx, "weight", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeItem(idx)}
                      disabled={form.items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>{t("orderNotesLabel") || "Notes"}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("orderNotes") || "Order notes..."} rows={2} />
          </div>

          {/* Summary */}
          <Separator />
          <div className="bg-muted/30 rounded p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{t("totalOrderAmount") || "Items Total"}</span>
              <span className="font-medium">${totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("shippingCost") || "Shipping"}</span>
              <span>${shippingCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("downPaymentLabel") || "Down Payment"}</span>
              <span className="text-green-600">-${downPayment.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>{t("remainingBalance") || "Remaining Balance"}</span>
              <span className="text-primary">${remaining.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel") || "Cancel"}</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving..." : (editOrder ? (t("updateOrder") || "Update") : (t("createOrder") || "Create Order"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewOrderModal({ order, open, onClose }: { order: OrderWithItems | null; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  if (!order) return null;

  const totalAmount = parseFloat(order.totalAmount || "0");
  const shippingCost = parseFloat(order.shippingCost || "0");
  const downPayment = parseFloat(order.downPayment || "0");
  const remaining = parseFloat(order.remainingBalance || "0");
  const lydrAte = parseFloat(order.lydExchangeRate || "1");
  const totalLYD = (totalAmount + shippingCost) * lydrAte;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("orderDetailsTitle") || "Order Details"} — {order.orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || ""}`}>
              {getStatusLabel(order.status, t)}
            </span>
            <span className="text-sm text-muted-foreground">{format(new Date(order.createdAt), "PPP")}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm">{t("orderInformation") || "Order Info"}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1 text-sm">
                <div><span className="text-muted-foreground">{t("orderNumberLabel") || "Order #"}:</span> <span className="font-medium">{order.orderNumber}</span></div>
                <div><span className="text-muted-foreground">{t("receiverName") || "Receiver"}:</span> {order.receiverName}</div>
                <div><span className="text-muted-foreground">{t("phone") || "Phone"}:</span> {order.receiverPhone}</div>
                {order.customer && <div><span className="text-muted-foreground">{t("customer") || "Customer"}:</span> {order.customer.name}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm">{t("shippingCategory") || "Shipping"}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1 text-sm">
                <div><span className="text-muted-foreground">{t("shippingCountry") || "Country"}:</span> {order.shippingCountry}</div>
                <div><span className="text-muted-foreground">{t("shippingCity") || "City"}:</span> {order.shippingCity}</div>
                <div><span className="text-muted-foreground">{t("shippingCategory") || "Category"}:</span> {order.shippingCategory}</div>
                <div><span className="text-muted-foreground">{t("shippingWeightKg") || "Weight"}:</span> {order.shippingWeight} kg</div>
              </CardContent>
            </Card>
          </div>

          {/* Items table */}
          <div>
            <h4 className="text-sm font-semibold mb-2">{t("orderItemsTitle") || "Items"}</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("product") || "Product"}</TableHead>
                  <TableHead className="text-center">{t("quantity") || "Qty"}</TableHead>
                  <TableHead className="text-right">{t("price") || "Price $"}</TableHead>
                  <TableHead className="text-right">{t("costPrice") || "Cost $"}</TableHead>
                  <TableHead className="text-right">{t("profit") || "Profit"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">${parseFloat(item.price || "0").toFixed(2)}</TableCell>
                    <TableCell className="text-right">${parseFloat(item.cost || "0").toFixed(2)}</TableCell>
                    <TableCell className="text-right text-green-600">${parseFloat(item.profit || "0").toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Financial summary */}
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>{t("totalOrderAmount") || "Items Total"}</span><span>${totalAmount.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t("shippingCostLabel") || "Shipping"}</span><span>${shippingCost.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t("downPaymentLabel") || "Down Payment"}</span><span className="text-green-600">-${downPayment.toFixed(2)}</span></div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>{t("remainingBalance") || "Remaining"}</span>
                <span className="text-primary">${remaining.toFixed(2)}</span>
              </div>
              {lydrAte > 1 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("totalInLYD") || "Total in LYD"} (×{lydrAte})</span>
                  <span>{totalLYD.toFixed(2)} LYD</span>
                </div>
              )}
            </CardContent>
          </Card>

          {order.notes && (
            <div>
              <h4 className="text-sm font-semibold mb-1">{t("orderNotesLabel") || "Notes"}</h4>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2">{order.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("close") || "Close"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Orders() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<OrderWithItems | null>(null);
  const [viewOrder, setViewOrder] = useState<OrderWithItems | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<OrderWithItems | null>(null);

  const { data: allOrders = [], isLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: t("success") || "Success", description: t("orderDeletedSuccess") || "Order deleted" });
      setDeleteOrder(null);
    },
    onError: () => {
      toast({ title: t("error") || "Error", description: t("failedDeleteOrder") || "Failed to delete order", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: t("success") || "Success", description: t("orderMarkedAsProcessing") || "Order status updated" });
    },
  });

  const filtered = allOrders.filter((o) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      o.orderNumber?.toLowerCase().includes(q) ||
      o.receiverName?.toLowerCase().includes(q) ||
      o.receiverPhone?.includes(q) ||
      o.shippingCity?.toLowerCase().includes(q) ||
      o.customer?.name?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOrders = filtered.length;
  const totalAmount = filtered.reduce((s, o) => s + parseFloat(o.totalAmount || "0"), 0);
  const totalRemaining = filtered.reduce((s, o) => s + parseFloat(o.remainingBalance || "0"), 0);
  const pendingCount = filtered.filter((o) => o.status === "pending").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            {t("ordersTitle") || "Orders"}
          </h1>
          <p className="text-muted-foreground text-sm">{t("ordersDescription") || "Manage and track all customer orders"}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-order">
          <Plus className="h-4 w-4 mr-2" /> {t("newOrder") || "New Order"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("totalOrders") || "Total Orders"}</p>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("pending") || "Pending"}</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("totalOrderAmount") || "Items Total"}</p>
            <p className="text-2xl font-bold">${totalAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("remainingBalance") || "Remaining"}</p>
            <p className="text-2xl font-bold text-primary">${totalRemaining.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t("searchOrders") || "Search orders..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-orders"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48" data-testid="select-status-filter">
                <SelectValue placeholder={t("filterByStatus") || "Filter by status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses") || "All Statuses"}</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{getStatusLabel(s, t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">{search || statusFilter !== "all" ? (t("noOrdersMatch") || "No orders match") : (t("noOrdersFound") || "No orders found")}</p>
              {!search && statusFilter === "all" && (
                <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> {t("createFirstOrder") || "Create First Order"}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("orderNumber") || "Order #"}</TableHead>
                    <TableHead>{t("customer") || "Receiver"}</TableHead>
                    <TableHead>{t("shippingCity") || "City"}</TableHead>
                    <TableHead>{t("orderStatus") || "Status"}</TableHead>
                    <TableHead className="text-right">{t("totalOrderAmount") || "Total"}</TableHead>
                    <TableHead className="text-right">{t("shippingCost") || "Shipping"}</TableHead>
                    <TableHead className="text-right">{t("remainingBalance") || "Remaining"}</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">{t("actions") || "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order) => (
                    <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.receiverName}</p>
                          <p className="text-xs text-muted-foreground">{order.receiverPhone}</p>
                          {order.customer && <p className="text-xs text-primary">{order.customer.name}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{order.shippingCity}, {order.shippingCountry}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || ""}`}>
                          {getStatusLabel(order.status, t)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">${parseFloat(order.totalAmount || "0").toFixed(2)}</TableCell>
                      <TableCell className="text-right">${parseFloat(order.shippingCost || "0").toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium text-primary">${parseFloat(order.remainingBalance || "0").toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(order.createdAt), "PP")}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setViewOrder(order)} data-testid={`button-view-order-${order.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditOrder(order)} data-testid={`button-edit-order-${order.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteOrder(order)} data-testid={`button-delete-order-${order.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {(createOpen || editOrder) && (
        <OrderFormModal
          open={createOpen || !!editOrder}
          onClose={() => { setCreateOpen(false); setEditOrder(null); }}
          editOrder={editOrder}
          customers={customers}
        />
      )}

      {/* View Modal */}
      <ViewOrderModal order={viewOrder} open={!!viewOrder} onClose={() => setViewOrder(null)} />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteOrder} onOpenChange={() => setDeleteOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteOrderTitle") || "Delete Order"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteOrderConfirmation") || "Are you sure you want to delete this order?"} ({deleteOrder?.orderNumber})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteOrder && deleteMutation.mutate(deleteOrder.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : (t("delete") || "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
