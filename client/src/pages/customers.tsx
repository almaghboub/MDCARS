import { useState, useMemo } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Search, Users, Phone, Mail, DollarSign, Eye, ChevronDown, ChevronRight, CreditCard, CheckCircle2, Clock } from "lucide-react";
import type { Customer, CustomerWithSales, SaleWithDetails, SaleItem } from "@shared/schema";
import { format } from "date-fns";

const customerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
  balanceOwed: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

function CreditInvoiceRow({ sale, onMarkPaid, markingId }: {
  sale: SaleWithDetails;
  onMarkPaid: (itemId: string) => void;
  markingId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const amountDue = parseFloat(sale.amountDue as string);
  const amountPaid = parseFloat(sale.amountPaid as string);
  const unpaidItems = sale.items.filter(i => !i.isPaid);
  const paidItems = sale.items.filter(i => i.isPaid);
  const isSaleFullyPaid = amountDue <= 0 || unpaidItems.length === 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div
          className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
          data-testid={`invoice-row-${sale.id}`}
        >
          <div className="flex items-center gap-3">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <div>
              <p className="font-semibold text-sm">{sale.saleNumber}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(sale.createdAt), "PPp")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold text-sm">{parseFloat(sale.totalAmount as string).toFixed(2)} {sale.currency}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="font-semibold text-sm text-green-600">{amountPaid.toFixed(2)} {sale.currency}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className={`font-semibold text-sm ${isSaleFullyPaid ? 'text-green-600' : 'text-destructive'}`}>
                {isSaleFullyPaid ? '0.00' : amountDue.toFixed(2)} {sale.currency}
              </p>
            </div>
            {isSaleFullyPaid
              ? <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Paid</Badge>
              : <Badge variant="destructive"><Clock className="w-3 h-3 mr-1" />Unpaid</Badge>
            }
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 ml-7 border-l-2 border-muted pl-4 space-y-1 pb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-2 mb-1">Items</p>
          {sale.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-2 rounded text-sm ${item.isPaid ? 'opacity-60 bg-muted/30' : 'bg-background border'}`}
              data-testid={`item-row-${item.id}`}
            >
              <div className="flex items-center gap-3">
                {!item.isPaid ? (
                  <Checkbox
                    id={`item-${item.id}`}
                    checked={false}
                    disabled={markingId === item.id}
                    onCheckedChange={() => onMarkPaid(item.id)}
                    data-testid={`checkbox-item-${item.id}`}
                  />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {parseFloat(item.unitPrice as string).toFixed(2)} {sale.currency}
                    {item.isPaid && item.paidAt && (
                      <span className="ml-2 text-green-600">✓ Paid {format(new Date(item.paidAt), "PP")}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${item.isPaid ? 'line-through text-muted-foreground' : ''}`}>
                  {parseFloat(item.totalPrice as string).toFixed(2)} {sale.currency}
                </p>
                {!item.isPaid && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 h-6 text-xs px-2"
                    disabled={markingId === item.id}
                    onClick={() => onMarkPaid(item.id)}
                    data-testid={`button-pay-item-${item.id}`}
                  >
                    {markingId === item.id ? "..." : "Mark Paid"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function Customers() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("LYD");
  const [markingItemId, setMarkingItemId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: customerInvoices = [], isLoading: invoicesLoading } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/customers", viewingCustomer?.id, "invoices"],
    enabled: !!viewingCustomer?.id && isViewDialogOpen,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers/${viewingCustomer!.id}/invoices`);
      return res.json();
    },
  });

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { name: "", phone: "", email: "", address: "", notes: "", balanceOwed: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const res = await apiRequest("POST", "/api/customers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: t("customerSaved") });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CustomerFormData> }) => {
      const res = await apiRequest("PATCH", `/api/customers/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: t("customerSaved") });
      setIsDialogOpen(false);
      setEditingCustomer(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: t("customerDeleted") });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ id, amount, currency }: { id: string; amount: string; currency: string }) => {
      const res = await apiRequest("POST", `/api/customers/${id}/payment`, { amount, currency });
      return res.json();
    },
    onSuccess: (updatedCustomer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      toast({ title: "Payment recorded successfully" });
      setIsPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentCurrency("LYD");
      setViewingCustomer(updatedCustomer);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("PATCH", `/api/sale-items/${itemId}/mark-paid`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", viewingCustomer?.id, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      if (data.customer) {
        setViewingCustomer(data.customer);
      }
      setMarkingItemId(null);
      toast({ title: "Item marked as paid", description: "Customer balance updated." });
    },
    onError: (error: any) => {
      setMarkingItemId(null);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleMarkPaid = (itemId: string) => {
    setMarkingItemId(itemId);
    markPaidMutation.mutate(itemId);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    form.reset({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
      balanceOwed: customer.balanceOwed || "0",
    });
    setIsDialogOpen(true);
  };

  const handleView = (customer: Customer) => {
    setViewingCustomer(customer);
    setIsViewDialogOpen(true);
  };

  const onSubmit = (data: CustomerFormData) => {
    const payload = {
      ...data,
      balanceOwed: data.balanceOwed && data.balanceOwed !== "" ? data.balanceOwed : "0",
    };
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const creditInvoices = customerInvoices.filter(s => parseFloat(s.amountDue as string) > 0 || s.items.some(i => !i.isPaid));
  const regularInvoices = customerInvoices.filter(s => parseFloat(s.amountDue as string) <= 0 && s.items.every(i => i.isPaid));

  const creditSummary = useMemo(() => {
    const allCreditItems = customerInvoices.flatMap(s =>
      parseFloat(s.amountDue as string) > 0 || s.items.some(i => !i.isPaid) ? s.items : []
    );
    const totalCredit = allCreditItems.reduce((sum, i) => sum + parseFloat(i.totalPrice as string), 0);
    const totalPaidItems = allCreditItems.filter(i => i.isPaid).reduce((sum, i) => sum + parseFloat(i.totalPrice as string), 0);
    const totalUnpaid = allCreditItems.filter(i => !i.isPaid).reduce((sum, i) => sum + parseFloat(i.totalPrice as string), 0);
    return { totalCredit, totalPaidItems, totalUnpaid };
  }, [customerInvoices]);

  const currentViewingCustomer = viewingCustomer ? customers.find(c => c.id === viewingCustomer.id) || viewingCustomer : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-customers-title">{t("customers")}</h1>
          <p className="text-muted-foreground">{t("manageCustomers")}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingCustomer(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-customer">
              <Plus className="w-4 h-4 mr-2" />
              {t("addCustomer")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCustomer ? t("editCustomer") : t("addCustomer")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("name")}</FormLabel>
                    <FormControl><Input {...field} data-testid="input-customer-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("phone")}</FormLabel>
                    <FormControl><Input {...field} data-testid="input-customer-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("email")} (Optional)</FormLabel>
                    <FormControl><Input type="email" {...field} data-testid="input-customer-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("address")} (Optional)</FormLabel>
                    <FormControl><Textarea {...field} data-testid="input-customer-address" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("notes")} (Optional)</FormLabel>
                    <FormControl><Textarea {...field} data-testid="input-customer-notes" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="balanceOwed" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("balanceOwed")} LYD {editingCustomer ? "" : `(${t("optional")})`}</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} data-testid="input-customer-balance" placeholder="0.00" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-customer">
                  {createMutation.isPending || updateMutation.isPending ? t("saving") : editingCustomer ? t("editCustomer") : t("addCustomer")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t("customers")} ({filteredCustomers.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchCustomers")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-customers"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{t("loading")}</p>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t("noCustomersFound")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("phone")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("totalPurchases")}</TableHead>
                  <TableHead>{t("balanceOwed")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} data-testid={`customer-row-${customer.id}`}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.email ? (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{customer.totalPurchases} LYD</TableCell>
                    <TableCell>
                      {parseFloat(customer.balanceOwed) > 0 ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <DollarSign className="w-3 h-3" />
                          {customer.balanceOwed} LYD
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Paid</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleView(customer)} data-testid={`button-view-${customer.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(customer)} data-testid={`button-edit-${customer.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(customer.id)} data-testid={`button-delete-${customer.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
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

      <Dialog open={isViewDialogOpen} onOpenChange={(open) => {
        setIsViewDialogOpen(open);
        if (!open) setViewingCustomer(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {currentViewingCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          {currentViewingCustomer && (
            <div className="flex flex-col gap-4 overflow-hidden flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t("phone")}</p>
                  <p className="font-medium">{currentViewingCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("email")}</p>
                  <p className="font-medium">{currentViewingCustomer.email || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("address")}</p>
                  <p className="font-medium">{currentViewingCustomer.address || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("totalPurchases")}</p>
                  <p className="font-bold">{currentViewingCustomer.totalPurchases} LYD</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Credit Amount</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    {invoicesLoading ? "..." : creditSummary.totalCredit.toFixed(2)} LYD
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">Total Paid (Items)</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">
                    {invoicesLoading ? "..." : creditSummary.totalPaidItems.toFixed(2)} LYD
                  </p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">Balance Owed</p>
                  <p className="text-lg font-bold text-red-700 dark:text-red-300">
                    {parseFloat(currentViewingCustomer.balanceOwed).toFixed(2)} LYD
                  </p>
                </div>
              </div>

              {parseFloat(currentViewingCustomer.balanceOwed) > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => setIsPaymentDialogOpen(true)}
                  data-testid="button-record-payment"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Record Manual Payment
                </Button>
              )}

              <Tabs defaultValue="credit" className="flex flex-col flex-1 overflow-hidden">
                <TabsList className="w-full">
                  <TabsTrigger value="credit" className="flex-1" data-testid="tab-credit-invoices">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Credit Invoices ({creditInvoices.length})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="flex-1" data-testid="tab-all-invoices">
                    All Invoices ({customerInvoices.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="credit" className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
                  {invoicesLoading ? (
                    <p className="text-muted-foreground text-center py-6">{t("loading")}</p>
                  ) : creditInvoices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                      <p>No outstanding credit invoices</p>
                    </div>
                  ) : (
                    creditInvoices.map((sale) => (
                      <CreditInvoiceRow
                        key={sale.id}
                        sale={sale}
                        onMarkPaid={handleMarkPaid}
                        markingId={markingItemId}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="all" className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
                  {invoicesLoading ? (
                    <p className="text-muted-foreground text-center py-6">{t("loading")}</p>
                  ) : customerInvoices.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No invoices found</p>
                  ) : (
                    customerInvoices.map((sale) => (
                      <div key={sale.id} className="flex justify-between items-center p-3 rounded-lg border text-sm" data-testid={`all-invoice-${sale.id}`}>
                        <div>
                          <p className="font-semibold">{sale.saleNumber}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(sale.createdAt), "PPp")}</p>
                          <p className="text-xs text-muted-foreground">{sale.items.length} item(s)</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="font-bold">{parseFloat(sale.totalAmount as string).toFixed(2)} {sale.currency}</p>
                          {parseFloat(sale.amountDue as string) > 0 ? (
                            <Badge variant="destructive" className="text-xs">Credit: {parseFloat(sale.amountDue as string).toFixed(2)}</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">Paid</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Manual Payment</DialogTitle>
          </DialogHeader>
          {currentViewingCustomer && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded">
                <p className="text-sm text-muted-foreground">{t("balanceOwed")}</p>
                <p className="text-xl font-bold text-destructive">{currentViewingCustomer.balanceOwed} LYD</p>
              </div>
              <div>
                <label className="text-sm font-medium">{t("currency")}</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={paymentCurrency}
                  onChange={(e) => setPaymentCurrency(e.target.value)}
                  data-testid="select-payment-currency"
                >
                  <option value="LYD">LYD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t("amount")} ({paymentCurrency})</label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  data-testid="input-payment-amount"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => paymentMutation.mutate({ id: currentViewingCustomer.id, amount: paymentAmount, currency: paymentCurrency })}
                disabled={!paymentAmount || paymentMutation.isPending}
                data-testid="button-submit-payment"
              >
                {paymentMutation.isPending ? "Processing..." : t("recordPayment")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
