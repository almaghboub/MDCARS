import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Search, Users, Phone, Mail, DollarSign, Eye } from "lucide-react";
import type { Customer, CustomerWithSales, Sale } from "@shared/schema";
import { format } from "date-fns";

const customerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

export default function Customers() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerWithSales | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    },
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
    mutationFn: async ({ id, amount }: { id: string; amount: string }) => {
      const res = await apiRequest("POST", `/api/customers/${id}/payment`, { amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Payment recorded successfully" });
      setIsPaymentDialogOpen(false);
      setPaymentAmount("");
      setViewingCustomer(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    form.reset({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleView = async (customer: Customer) => {
    try {
      const res = await apiRequest("GET", `/api/customers/${customer.id}`);
      const data = await res.json();
      setViewingCustomer(data);
      setIsViewDialogOpen(true);
    } catch (error) {
      toast({ title: "Error loading customer details", variant: "destructive" });
    }
  };

  const onSubmit = (data: CustomerFormData) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-customers-title">{t("customers")}</h1>
          <p className="text-muted-foreground">{t("manageCustomers")}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingCustomer(null);
            form.reset();
          }
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

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("customers")}</DialogTitle>
          </DialogHeader>
          {viewingCustomer && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("name")}</p>
                  <p className="font-medium">{viewingCustomer.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("phone")}</p>
                  <p className="font-medium">{viewingCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("email")}</p>
                  <p className="font-medium">{viewingCustomer.email || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("address")}</p>
                  <p className="font-medium">{viewingCustomer.address || "-"}</p>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">{t("totalPurchases")}</p>
                  <p className="text-xl font-bold">{viewingCustomer.totalPurchases} LYD</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("balanceOwed")}</p>
                  <p className={`text-xl font-bold ${parseFloat(viewingCustomer.balanceOwed) > 0 ? 'text-destructive' : ''}`}>
                    {viewingCustomer.balanceOwed} LYD
                  </p>
                </div>
                {parseFloat(viewingCustomer.balanceOwed) > 0 && (
                  <Button onClick={() => setIsPaymentDialogOpen(true)} data-testid="button-record-payment">
                    Record Payment
                  </Button>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-2">{t("purchaseHistory")}</h4>
                {viewingCustomer.sales && viewingCustomer.sales.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {viewingCustomer.sales.map((sale: Sale) => (
                      <div key={sale.id} className="flex justify-between items-center p-3 bg-muted rounded">
                        <div>
                          <p className="font-medium">{sale.saleNumber}</p>
                          <p className="text-sm text-muted-foreground">{format(new Date(sale.createdAt), "PPp")}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{sale.totalAmount} {sale.currency}</p>
                          <Badge variant={sale.status === "completed" ? "secondary" : "outline"}>{sale.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No purchases yet</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {viewingCustomer && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded">
                <p className="text-sm text-muted-foreground">{t("balanceOwed")}</p>
                <p className="text-xl font-bold text-destructive">{viewingCustomer.balanceOwed} LYD</p>
              </div>
              <div>
                <label className="text-sm font-medium">Payment Amount (LYD)</label>
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
                onClick={() => paymentMutation.mutate({ id: viewingCustomer.id, amount: paymentAmount })}
                disabled={!paymentAmount || paymentMutation.isPending}
                data-testid="button-submit-payment"
              >
                {paymentMutation.isPending ? "Processing..." : "Record Payment"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
