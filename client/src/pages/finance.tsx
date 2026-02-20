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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Wallet, Plus, ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, Trash2, ShoppingCart, Eye, Users, Percent, PiggyBank, Edit, Handshake } from "lucide-react";
import type { Cashbox, CashboxTransaction, Expense, Revenue, SaleWithDetails, Partner, PartnerTransaction, SupplierPayable } from "@shared/schema";
import { format } from "date-fns";
import { SaleInvoiceDialog } from "@/components/sale-invoice-dialog";

const expenseFormSchema = z.object({
  category: z.enum(["rent", "utilities", "salaries", "supplies", "maintenance", "marketing", "other"]),
  amount: z.string().min(1, "Amount is required"),
  currency: z.enum(["LYD", "USD"]),
  description: z.string().min(1, "Description is required"),
  personName: z.string().optional(),
});

const revenueFormSchema = z.object({
  source: z.string().min(1, "Source is required"),
  amount: z.string().min(1, "Amount is required"),
  currency: z.enum(["LYD", "USD"]),
  description: z.string().optional(),
});

const cashboxTransactionFormSchema = z.object({
  type: z.enum(["deposit", "withdrawal"]),
  amountUSD: z.string().optional(),
  amountLYD: z.string().optional(),
  description: z.string().optional(),
});

const partnerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().optional(),
  ownershipPercentage: z.string().min(1, "Ownership percentage is required"),
});

const partnerTransactionFormSchema = z.object({
  partnerId: z.string().min(1, "Partner is required"),
  type: z.enum(["investment", "withdrawal", "profit_distribution"]),
  amount: z.string().min(1, "Amount is required"),
  currency: z.enum(["LYD", "USD"]),
  description: z.string().optional(),
});

export default function Finance() {
  const { t } = useI18n();
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [isPartnerTxDialogOpen, setIsPartnerTxDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const { toast } = useToast();

  const { data: cashbox } = useQuery<Cashbox>({
    queryKey: ["/api/cashbox"],
  });

  const { data: transactions = [] } = useQuery<CashboxTransaction[]>({
    queryKey: ["/api/cashbox/transactions"],
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: revenues = [] } = useQuery<Revenue[]>({
    queryKey: ["/api/revenues"],
  });

  const { data: allSales = [] } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/sales"],
  });

  const { data: partnersData = [] } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
  });

  const { data: partnerTransactions = [] } = useQuery<PartnerTransaction[]>({
    queryKey: ["/api/partner-transactions"],
  });

  const { data: goodsCapitalData } = useQuery<{ totalCapitalLYD: string }>({
    queryKey: ["/api/goods-capital"],
  });

  const { data: supplierPayables = [] } = useQuery<SupplierPayable[]>({
    queryKey: ["/api/supplier-payables"],
  });

  const expenseForm = useForm<z.infer<typeof expenseFormSchema>>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { category: "other", amount: "", currency: "LYD", description: "", personName: "" },
  });

  const revenueForm = useForm<z.infer<typeof revenueFormSchema>>({
    resolver: zodResolver(revenueFormSchema),
    defaultValues: { source: "", amount: "", currency: "LYD", description: "" },
  });

  const cashboxTxForm = useForm<z.infer<typeof cashboxTransactionFormSchema>>({
    resolver: zodResolver(cashboxTransactionFormSchema),
    defaultValues: { type: "deposit", amountUSD: "", amountLYD: "", description: "" },
  });

  const partnerForm = useForm<z.infer<typeof partnerFormSchema>>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: { name: "", phone: "", email: "", ownershipPercentage: "50" },
  });

  const partnerTxForm = useForm<z.infer<typeof partnerTransactionFormSchema>>({
    resolver: zodResolver(partnerTransactionFormSchema),
    defaultValues: { partnerId: "", type: "investment", amount: "", currency: "LYD", description: "" },
  });

  const expenseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof expenseFormSchema>) => {
      const res = await apiRequest("POST", "/api/expenses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      toast({ title: t("expenseRecordedSuccessfully") || "Expense recorded successfully" });
      setIsExpenseDialogOpen(false);
      expenseForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const revenueMutation = useMutation({
    mutationFn: async (data: z.infer<typeof revenueFormSchema>) => {
      const res = await apiRequest("POST", "/api/revenues", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      toast({ title: "Revenue recorded successfully" });
      setIsRevenueDialogOpen(false);
      revenueForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const cashboxTxMutation = useMutation({
    mutationFn: async (data: z.infer<typeof cashboxTransactionFormSchema>) => {
      const res = await apiRequest("POST", "/api/cashbox/transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      toast({ title: "Transaction recorded successfully" });
      setIsTransactionDialogOpen(false);
      cashboxTxForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense deleted" });
    },
  });

  const deleteRevenueMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/revenues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenues"] });
      toast({ title: "Revenue deleted" });
    },
  });

  const markPayablePaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/supplier-payables/${id}/pay`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-payables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      toast({ title: t("payableMarkedPaid") });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const createPartnerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof partnerFormSchema>) => {
      const res = await apiRequest("POST", "/api/partners", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: t("partnerAdded") });
      setIsPartnerDialogOpen(false);
      partnerForm.reset();
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const updatePartnerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof partnerFormSchema> }) => {
      const res = await apiRequest("PATCH", `/api/partners/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: t("partnerUpdated") });
      setIsPartnerDialogOpen(false);
      setEditingPartner(null);
      partnerForm.reset();
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const createPartnerTxMutation = useMutation({
    mutationFn: async (data: z.infer<typeof partnerTransactionFormSchema>) => {
      const res = await apiRequest("POST", "/api/partner-transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      toast({ title: t("transactionRecorded") });
      setIsPartnerTxDialogOpen(false);
      partnerTxForm.reset();
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const onPartnerSubmit = (data: z.infer<typeof partnerFormSchema>) => {
    if (editingPartner) {
      updatePartnerMutation.mutate({ id: editingPartner.id, data });
    } else {
      createPartnerMutation.mutate(data);
    }
  };

  const openEditPartner = (partner: Partner) => {
    setEditingPartner(partner);
    partnerForm.reset({
      name: partner.name,
      phone: partner.phone || "",
      email: partner.email || "",
      ownershipPercentage: partner.ownershipPercentage,
    });
    setIsPartnerDialogOpen(true);
  };

  const openAddPartner = () => {
    setEditingPartner(null);
    partnerForm.reset({ name: "", phone: "", email: "", ownershipPercentage: "50" });
    setIsPartnerDialogOpen(true);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalRevenues = revenues.reduce((sum, r) => sum + parseFloat(r.amount), 0);
  const completedSales = allSales.filter(s => s.status === "completed");
  const unpaidPayables = supplierPayables.filter(p => !p.isPaid);
  const paidPayables = supplierPayables.filter(p => p.isPaid);
  const totalUnpaidLYD = unpaidPayables.filter(p => p.currency === "LYD").reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const totalUnpaidUSD = unpaidPayables.filter(p => p.currency === "USD").reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const totalSalesLYD = completedSales.filter(s => s.currency === "LYD").reduce((sum, s) => sum + parseFloat(s.amountPaid), 0);
  const totalSalesUSD = completedSales.filter(s => s.currency === "USD").reduce((sum, s) => sum + parseFloat(s.amountPaid), 0);
  const totalOwnership = partnersData.reduce((sum, p) => sum + parseFloat(p.ownershipPercentage), 0);
  const totalCapital = partnersData.reduce((sum, p) => sum + parseFloat(p.totalInvested) - parseFloat(p.totalWithdrawn), 0);

  const getPartnerName = (id: string) => partnersData.find(p => p.id === id)?.name || "-";

  const typeColor = (type: string) => {
    switch (type) {
      case "investment": return "default";
      case "withdrawal": return "destructive";
      case "profit_distribution": return "secondary";
      default: return "outline";
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "investment": return <ArrowUpCircle className="w-3 h-3 mr-1" />;
      case "withdrawal": return <ArrowDownCircle className="w-3 h-3 mr-1" />;
      case "profit_distribution": return <PiggyBank className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-finance-title">{t("financialManagement")}</h1>
          <p className="text-muted-foreground">{t("manageFinances")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("cashbox")} LYD</p>
                <p className="text-2xl font-bold" data-testid="text-cashbox-lyd">{cashbox?.balanceLYD || "0.00"} LYD</p>
              </div>
              <Wallet className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("cashbox")} USD</p>
                <p className="text-2xl font-bold" data-testid="text-cashbox-usd">${cashbox?.balanceUSD || "0.00"}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("goodsCapital")}</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="text-goods-capital">
                  {goodsCapitalData?.totalCapitalLYD || "0.00"} LYD
                </p>
              </div>
              <ShoppingCart className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net (Rev - Exp)</p>
                <p className={`text-2xl font-bold ${totalRevenues - totalExpenses >= 0 ? 'text-green-500' : 'text-destructive'}`} data-testid="text-net">
                  {(totalRevenues - totalExpenses).toFixed(2)} LYD
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("storeCapital")}</p>
                <p className="text-2xl font-bold text-purple-600" data-testid="text-store-capital">
                  {totalCapital.toFixed(2)}
                </p>
              </div>
              <Handshake className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cashbox" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="cashbox">{t("cashbox")}</TabsTrigger>
          <TabsTrigger value="sales-income" data-testid="tab-sales-income">
            <ShoppingCart className="w-4 h-4 mr-1" />
            {t("salesIncome")} ({completedSales.length})
          </TabsTrigger>
          <TabsTrigger value="expenses">{t("expenses")} ({expenses.length})</TabsTrigger>
          <TabsTrigger value="revenues">{t("revenues")} ({revenues.length})</TabsTrigger>
          <TabsTrigger value="supplier-payables" data-testid="tab-supplier-payables">
            <DollarSign className="w-4 h-4 mr-1" />
            {t("supplierPayables")} ({unpaidPayables.length})
          </TabsTrigger>
          <TabsTrigger value="store-capital" data-testid="tab-store-capital">
            <Handshake className="w-4 h-4 mr-1" />
            {t("storeCapital")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cashbox" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  {t("cashbox")} {t("transactions")}
                </CardTitle>
                <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-transaction">
                      <Plus className="w-4 h-4 mr-2" />
                      {t("addTransaction")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("addTransaction")}</DialogTitle>
                    </DialogHeader>
                    <Form {...cashboxTxForm}>
                      <form onSubmit={cashboxTxForm.handleSubmit((data) => cashboxTxMutation.mutate(data))} className="space-y-4">
                        <FormField control={cashboxTxForm.control} name="type" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("type")}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="deposit">{t("deposit")}</SelectItem>
                                <SelectItem value="withdrawal">{t("withdrawal")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={cashboxTxForm.control} name="amountLYD" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("amountLYD")}</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={cashboxTxForm.control} name="amountUSD" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("amountUSD")}</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={cashboxTxForm.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("description")}</FormLabel>
                            <FormControl><Textarea {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={cashboxTxMutation.isPending}>
                          {cashboxTxMutation.isPending ? t("saving") : t("addTransaction")}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("noTransactions")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("type")}</TableHead>
                      <TableHead>{t("amountLYD")}</TableHead>
                      <TableHead>{t("amountUSD")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 20).map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{format(new Date(tx.createdAt), "PPp")}</TableCell>
                        <TableCell>
                          <Badge variant={tx.type === "deposit" || tx.type === "sale" ? "default" : "destructive"}>
                            {tx.type === "deposit" || tx.type === "sale" ? (
                              <ArrowUpCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <ArrowDownCircle className="w-3 h-3 mr-1" />
                            )}
                            {tx.type === "sale" ? t("sale") : tx.type === "expense" ? t("expense") : tx.type === "deposit" ? t("deposit") : tx.type === "withdrawal" ? t("withdrawal") : tx.type === "refund" ? t("refund") : tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{tx.amountLYD} LYD</TableCell>
                        <TableCell>${tx.amountUSD}</TableCell>
                        <TableCell>{tx.description || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales-income" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-green-500" />
                {t("salesIncome")} ({totalSalesLYD.toFixed(2)} LYD{totalSalesUSD > 0 ? ` | $${totalSalesUSD.toFixed(2)}` : ""})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allSales.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("noSalesIncome")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("saleNumber")}</TableHead>
                      <TableHead>{t("customer")}</TableHead>
                      <TableHead>{t("total")}</TableHead>
                      <TableHead>{t("paid")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`finance-sale-${sale.id}`}>
                        <TableCell>{format(new Date(sale.createdAt), "PPp")}</TableCell>
                        <TableCell className="font-medium">{sale.saleNumber}</TableCell>
                        <TableCell>{sale.customer?.name || t("walkin")}</TableCell>
                        <TableCell className="font-bold">{sale.totalAmount} {sale.currency}</TableCell>
                        <TableCell className="text-green-600 font-bold">{sale.amountPaid} {sale.currency}</TableCell>
                        <TableCell>
                          <Badge variant={sale.status === "completed" ? "default" : sale.status === "returned" ? "destructive" : "secondary"}>
                            {sale.status === "completed" ? t("completed") : sale.status === "returned" ? t("returned") : sale.status === "cancelled" ? t("cancelled") : t("pending")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedSale(sale); setInvoiceOpen(true); }}
                            data-testid={`button-finance-invoice-${sale.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownCircle className="w-5 h-5 text-destructive" />
                  {t("expenses")} (Total: {totalExpenses.toFixed(2)} LYD)
                </CardTitle>
                <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-add-expense">
                      <Plus className="w-4 h-4 mr-2" />
                      {t("addExpense")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("addExpense")}</DialogTitle>
                    </DialogHeader>
                    <Form {...expenseForm}>
                      <form onSubmit={expenseForm.handleSubmit((data) => expenseMutation.mutate(data))} className="space-y-4">
                        <FormField control={expenseForm.control} name="category" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("category")}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="rent">{t("rent")}</SelectItem>
                                <SelectItem value="utilities">{t("utilities")}</SelectItem>
                                <SelectItem value="salaries">{t("salaries")}</SelectItem>
                                <SelectItem value="supplies">{t("supplies")}</SelectItem>
                                <SelectItem value="maintenance">{t("maintenance")}</SelectItem>
                                <SelectItem value="marketing">{t("marketing")}</SelectItem>
                                <SelectItem value="other">{t("other")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={expenseForm.control} name="amount" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("amount")}</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={expenseForm.control} name="currency" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("currency")}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="LYD">LYD</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={expenseForm.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("description")}</FormLabel>
                            <FormControl><Textarea {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={expenseForm.control} name="personName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Paid To (Optional)</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={expenseMutation.isPending}>
                          {expenseMutation.isPending ? t("saving") : t("addExpense")}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("noExpenses")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>{t("category")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead>{t("amount")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{format(new Date(expense.date), "PP")}</TableCell>
                        <TableCell>{expense.expenseNumber}</TableCell>
                        <TableCell><Badge variant="outline">{expense.category}</Badge></TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell className="font-bold text-destructive">{expense.amount} {expense.currency}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => deleteExpenseMutation.mutate(expense.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenues" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpCircle className="w-5 h-5 text-green-500" />
                  {t("revenues")} (Total: {totalRevenues.toFixed(2)} LYD)
                </CardTitle>
                <Dialog open={isRevenueDialogOpen} onOpenChange={setIsRevenueDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700" data-testid="button-add-revenue">
                      <Plus className="w-4 h-4 mr-2" />
                      {t("addRevenue")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("addRevenue")}</DialogTitle>
                    </DialogHeader>
                    <Form {...revenueForm}>
                      <form onSubmit={revenueForm.handleSubmit((data) => revenueMutation.mutate(data))} className="space-y-4">
                        <FormField control={revenueForm.control} name="source" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Source</FormLabel>
                            <FormControl><Input {...field} placeholder="e.g., Interest, Investment, etc." /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={revenueForm.control} name="amount" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("amount")}</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={revenueForm.control} name="currency" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("currency")}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="LYD">LYD</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={revenueForm.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("description")}</FormLabel>
                            <FormControl><Textarea {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={revenueMutation.isPending}>
                          {revenueMutation.isPending ? t("saving") : t("addRevenue")}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {revenues.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("noRevenues")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead>{t("amount")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenues.map((revenue) => (
                      <TableRow key={revenue.id}>
                        <TableCell>{format(new Date(revenue.date), "PP")}</TableCell>
                        <TableCell>{revenue.revenueNumber}</TableCell>
                        <TableCell><Badge variant="secondary">{revenue.source}</Badge></TableCell>
                        <TableCell>{revenue.description || "-"}</TableCell>
                        <TableCell className="font-bold text-green-600">{revenue.amount} {revenue.currency}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => deleteRevenueMutation.mutate(revenue.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplier-payables" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{t("totalUnpaid")} (LYD)</p>
                <p className="text-xl font-bold text-red-600" data-testid="text-unpaid-lyd">{totalUnpaidLYD.toFixed(2)} LYD</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{t("totalUnpaid")} (USD)</p>
                <p className="text-xl font-bold text-red-600" data-testid="text-unpaid-usd">{totalUnpaidUSD.toFixed(2)} USD</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{t("totalRecords")}</p>
                <p className="text-xl font-bold" data-testid="text-payable-count">{unpaidPayables.length} {t("unpaid")} / {paidPayables.length} {t("paid")}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {t("unpaidSupplierDebts")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unpaidPayables.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("noUnpaidDebts")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{t("supplierName")}</TableHead>
                        <TableHead>{t("amount")}</TableHead>
                        <TableHead>{t("currency")}</TableHead>
                        <TableHead>{t("description")}</TableHead>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>{t("actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unpaidPayables.map((payable, idx) => (
                        <TableRow key={payable.id} data-testid={`row-payable-${payable.id}`}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">{payable.supplierName}</TableCell>
                          <TableCell className="font-bold text-red-600">{parseFloat(payable.amount).toFixed(2)}</TableCell>
                          <TableCell><Badge variant="outline">{payable.currency}</Badge></TableCell>
                          <TableCell>{payable.description || "-"}</TableCell>
                          <TableCell>{payable.createdAt ? format(new Date(payable.createdAt), "yyyy-MM-dd") : "-"}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => markPayablePaidMutation.mutate(payable.id)}
                              disabled={markPayablePaidMutation.isPending}
                              data-testid={`button-pay-${payable.id}`}
                            >
                              <DollarSign className="w-3 h-3 mr-1" />
                              {t("markAsPaid")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {paidPayables.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  {t("paidSupplierDebts")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{t("supplierName")}</TableHead>
                        <TableHead>{t("amount")}</TableHead>
                        <TableHead>{t("currency")}</TableHead>
                        <TableHead>{t("description")}</TableHead>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>{t("paidDate")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidPayables.map((payable, idx) => (
                        <TableRow key={payable.id} data-testid={`row-paid-${payable.id}`}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">{payable.supplierName}</TableCell>
                          <TableCell>{parseFloat(payable.amount).toFixed(2)}</TableCell>
                          <TableCell><Badge variant="outline">{payable.currency}</Badge></TableCell>
                          <TableCell>{payable.description || "-"}</TableCell>
                          <TableCell>{payable.createdAt ? format(new Date(payable.createdAt), "yyyy-MM-dd") : "-"}</TableCell>
                          <TableCell>{payable.paidAt ? format(new Date(payable.paidAt), "yyyy-MM-dd") : "-"}</TableCell>
                          <TableCell><Badge variant="secondary">{t("paid")}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="store-capital" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Handshake className="w-5 h-5" />
              {t("storeCapital")} - {t("partners")}
            </h2>
            <div className="flex gap-2">
              <Button onClick={openAddPartner} data-testid="button-add-partner">
                <Plus className="w-4 h-4 mr-2" />
                {t("addPartner")}
              </Button>
              <Button variant="outline" onClick={() => setIsPartnerTxDialogOpen(true)} data-testid="button-add-partner-transaction" disabled={partnersData.length === 0}>
                <DollarSign className="w-4 h-4 mr-2" />
                {t("recordTransaction")}
              </Button>
            </div>
          </div>

          {totalOwnership > 0 && totalOwnership !== 100 && (
            <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-md text-yellow-700 dark:text-yellow-400 text-sm">
              {t("ownershipWarning")} ({totalOwnership}%)
            </div>
          )}

          {partnersData.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("noPartnersYet")}</p>
                <p className="text-sm mt-2">{t("addPartnersToStart")}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {partnersData.map((partner) => {
                  const netBalance = parseFloat(partner.totalInvested) - parseFloat(partner.totalWithdrawn) - parseFloat(partner.totalProfitDistributed);
                  return (
                    <Card key={partner.id} className="relative" data-testid={`card-partner-${partner.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500" />
                            {partner.name}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-lg px-3 py-1">
                              <Percent className="w-4 h-4 mr-1" />
                              {partner.ownershipPercentage}%
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => openEditPartner(partner)} data-testid={`button-edit-partner-${partner.id}`}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {(partner.phone || partner.email) && (
                          <div className="text-sm text-muted-foreground space-y-1">
                            {partner.phone && <p>{t("phone")}: {partner.phone}</p>}
                            {partner.email && <p>{t("email")}: {partner.email}</p>}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-green-500/10 rounded-lg">
                            <p className="text-xs text-muted-foreground">{t("totalInvested")}</p>
                            <p className="text-lg font-bold text-green-600" data-testid={`text-invested-${partner.id}`}>
                              {parseFloat(partner.totalInvested).toFixed(2)}
                            </p>
                          </div>
                          <div className="p-3 bg-red-500/10 rounded-lg">
                            <p className="text-xs text-muted-foreground">{t("totalWithdrawn")}</p>
                            <p className="text-lg font-bold text-red-600" data-testid={`text-withdrawn-${partner.id}`}>
                              {parseFloat(partner.totalWithdrawn).toFixed(2)}
                            </p>
                          </div>
                          <div className="p-3 bg-blue-500/10 rounded-lg">
                            <p className="text-xs text-muted-foreground">{t("profitDistributed")}</p>
                            <p className="text-lg font-bold text-blue-600" data-testid={`text-profit-dist-${partner.id}`}>
                              {parseFloat(partner.totalProfitDistributed).toFixed(2)}
                            </p>
                          </div>
                          <div className="p-3 bg-purple-500/10 rounded-lg">
                            <p className="text-xs text-muted-foreground">{t("netBalance")}</p>
                            <p className={`text-lg font-bold ${netBalance >= 0 ? "text-purple-600" : "text-red-600"}`} data-testid={`text-net-${partner.id}`}>
                              {netBalance.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    {t("partnerTransactions")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {partnerTransactions.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">{t("noTransactionsYet")}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("date")}</TableHead>
                            <TableHead>{t("partner")}</TableHead>
                            <TableHead>{t("type")}</TableHead>
                            <TableHead>{t("amount")}</TableHead>
                            <TableHead>{t("currency")}</TableHead>
                            <TableHead>{t("description")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {partnerTransactions.map((tx) => (
                            <TableRow key={tx.id} data-testid={`row-partner-tx-${tx.id}`}>
                              <TableCell>{format(new Date(tx.createdAt), "PPp")}</TableCell>
                              <TableCell className="font-medium">{getPartnerName(tx.partnerId)}</TableCell>
                              <TableCell>
                                <Badge variant={typeColor(tx.type) as any}>
                                  {typeIcon(tx.type)}
                                  {tx.type === "investment" ? t("investment") : tx.type === "withdrawal" ? t("withdrawal") : t("profitDistribution")}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold">{tx.amount}</TableCell>
                              <TableCell>{tx.currency}</TableCell>
                              <TableCell>{tx.description || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isPartnerDialogOpen} onOpenChange={setIsPartnerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPartner ? t("editPartner") : t("addPartner")}</DialogTitle>
          </DialogHeader>
          <Form {...partnerForm}>
            <form onSubmit={partnerForm.handleSubmit(onPartnerSubmit)} className="space-y-4">
              <FormField control={partnerForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl><Input {...field} data-testid="input-partner-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={partnerForm.control} name="ownershipPercentage" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ownershipPercentage")} (%)</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" max="100" {...field} data-testid="input-ownership" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={partnerForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("phone")}</FormLabel>
                  <FormControl><Input {...field} data-testid="input-partner-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={partnerForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("email")}</FormLabel>
                  <FormControl><Input type="email" {...field} data-testid="input-partner-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createPartnerMutation.isPending || updatePartnerMutation.isPending} data-testid="button-submit-partner">
                {editingPartner ? t("update") : t("add")}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPartnerTxDialogOpen} onOpenChange={setIsPartnerTxDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recordTransaction")}</DialogTitle>
          </DialogHeader>
          <Form {...partnerTxForm}>
            <form onSubmit={partnerTxForm.handleSubmit((data) => createPartnerTxMutation.mutate(data))} className="space-y-4">
              <FormField control={partnerTxForm.control} name="partnerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("partner")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-partner">
                        <SelectValue placeholder={t("selectPartner")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {partnersData.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.ownershipPercentage}%)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={partnerTxForm.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("type")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-tx-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="investment">{t("investment")}</SelectItem>
                      <SelectItem value="withdrawal">{t("withdrawal")}</SelectItem>
                      <SelectItem value="profit_distribution">{t("profitDistribution")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={partnerTxForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("amount")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} data-testid="input-tx-amount" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={partnerTxForm.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("currency")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-tx-currency">
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
              <FormField control={partnerTxForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl><Textarea {...field} data-testid="input-tx-description" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createPartnerTxMutation.isPending} data-testid="button-submit-transaction">
                {t("recordTransaction")}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <SaleInvoiceDialog
        sale={selectedSale}
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
      />
    </div>
  );
}
