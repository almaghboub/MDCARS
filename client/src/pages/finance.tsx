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
import { Wallet, Plus, ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, Trash2, ShoppingCart, Eye } from "lucide-react";
import type { Cashbox, CashboxTransaction, Expense, Revenue, SaleWithDetails } from "@shared/schema";
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

const transactionFormSchema = z.object({
  type: z.enum(["deposit", "withdrawal"]),
  amountUSD: z.string().optional(),
  amountLYD: z.string().optional(),
  description: z.string().optional(),
});

export default function Finance() {
  const { t } = useI18n();
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
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

  const expenseForm = useForm<z.infer<typeof expenseFormSchema>>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { category: "other", amount: "", currency: "LYD", description: "", personName: "" },
  });

  const revenueForm = useForm<z.infer<typeof revenueFormSchema>>({
    resolver: zodResolver(revenueFormSchema),
    defaultValues: { source: "", amount: "", currency: "LYD", description: "" },
  });

  const transactionForm = useForm<z.infer<typeof transactionFormSchema>>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: { type: "deposit", amountUSD: "", amountLYD: "", description: "" },
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

  const transactionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof transactionFormSchema>) => {
      const res = await apiRequest("POST", "/api/cashbox/transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      toast({ title: "Transaction recorded successfully" });
      setIsTransactionDialogOpen(false);
      transactionForm.reset();
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

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalRevenues = revenues.reduce((sum, r) => sum + parseFloat(r.amount), 0);
  const completedSales = allSales.filter(s => s.status === "completed");
  const totalSalesLYD = completedSales.filter(s => s.currency === "LYD").reduce((sum, s) => sum + parseFloat(s.amountPaid), 0);
  const totalSalesUSD = completedSales.filter(s => s.currency === "USD").reduce((sum, s) => sum + parseFloat(s.amountPaid), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-finance-title">{t("financialManagement")}</h1>
          <p className="text-muted-foreground">{t("manageFinances")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <p className="text-sm text-muted-foreground">Net (Rev - Exp)</p>
                <p className={`text-2xl font-bold ${totalRevenues - totalExpenses >= 0 ? 'text-green-500' : 'text-destructive'}`} data-testid="text-net">
                  {(totalRevenues - totalExpenses).toFixed(2)} LYD
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cashbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cashbox">{t("cashbox")}</TabsTrigger>
          <TabsTrigger value="sales-income" data-testid="tab-sales-income">
            <ShoppingCart className="w-4 h-4 mr-1" />
            {t("salesIncome")} ({completedSales.length})
          </TabsTrigger>
          <TabsTrigger value="expenses">{t("expenses")} ({expenses.length})</TabsTrigger>
          <TabsTrigger value="revenues">{t("revenues")} ({revenues.length})</TabsTrigger>
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
                    <Form {...transactionForm}>
                      <form onSubmit={transactionForm.handleSubmit((data) => transactionMutation.mutate(data))} className="space-y-4">
                        <FormField control={transactionForm.control} name="type" render={({ field }) => (
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
                          <FormField control={transactionForm.control} name="amountLYD" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("amountLYD")}</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={transactionForm.control} name="amountUSD" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("amountUSD")}</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={transactionForm.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("description")}</FormLabel>
                            <FormControl><Textarea {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={transactionMutation.isPending}>
                          {transactionMutation.isPending ? t("saving") : t("addTransaction")}
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
      </Tabs>

      <SaleInvoiceDialog
        sale={selectedSale}
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
      />
    </div>
  );
}
