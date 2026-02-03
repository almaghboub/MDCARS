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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Wallet, Plus, ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, Trash2 } from "lucide-react";
import type { Cashbox, CashboxTransaction, Expense, Revenue } from "@shared/schema";
import { format } from "date-fns";

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
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
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
      toast({ title: "Expense recorded successfully" });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-finance-title">Financial Management</h1>
          <p className="text-muted-foreground">Manage cashbox, expenses, and revenues</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cashbox LYD</p>
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
                <p className="text-sm text-muted-foreground">Cashbox USD</p>
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
          <TabsTrigger value="cashbox">Cashbox</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
          <TabsTrigger value="revenues">Revenues ({revenues.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="cashbox" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Cashbox Transactions
                </CardTitle>
                <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-transaction">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Transaction
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Cashbox Transaction</DialogTitle>
                    </DialogHeader>
                    <Form {...transactionForm}>
                      <form onSubmit={transactionForm.handleSubmit((data) => transactionMutation.mutate(data))} className="space-y-4">
                        <FormField control={transactionForm.control} name="type" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="deposit">Deposit</SelectItem>
                                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={transactionForm.control} name="amountLYD" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount LYD</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={transactionForm.control} name="amountUSD" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount USD</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={transactionForm.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl><Textarea {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={transactionMutation.isPending}>
                          {transactionMutation.isPending ? "Saving..." : "Add Transaction"}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No transactions yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount LYD</TableHead>
                      <TableHead>Amount USD</TableHead>
                      <TableHead>Description</TableHead>
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
                            {tx.type}
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

        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownCircle className="w-5 h-5 text-destructive" />
                  Expenses (Total: {totalExpenses.toFixed(2)} LYD)
                </CardTitle>
                <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-add-expense">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Expense</DialogTitle>
                    </DialogHeader>
                    <Form {...expenseForm}>
                      <form onSubmit={expenseForm.handleSubmit((data) => expenseMutation.mutate(data))} className="space-y-4">
                        <FormField control={expenseForm.control} name="category" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="rent">Rent</SelectItem>
                                <SelectItem value="utilities">Utilities</SelectItem>
                                <SelectItem value="salaries">Salaries</SelectItem>
                                <SelectItem value="supplies">Supplies</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                <SelectItem value="marketing">Marketing</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={expenseForm.control} name="amount" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={expenseForm.control} name="currency" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Currency</FormLabel>
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
                            <FormLabel>Description</FormLabel>
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
                          {expenseMutation.isPending ? "Saving..." : "Add Expense"}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No expenses recorded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Actions</TableHead>
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
                  Revenues (Total: {totalRevenues.toFixed(2)} LYD)
                </CardTitle>
                <Dialog open={isRevenueDialogOpen} onOpenChange={setIsRevenueDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700" data-testid="button-add-revenue">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Revenue
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Revenue</DialogTitle>
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
                              <FormLabel>Amount</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={revenueForm.control} name="currency" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Currency</FormLabel>
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
                            <FormLabel>Description</FormLabel>
                            <FormControl><Textarea {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={revenueMutation.isPending}>
                          {revenueMutation.isPending ? "Saving..." : "Add Revenue"}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {revenues.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No revenues recorded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Actions</TableHead>
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
    </div>
  );
}
