import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, Plus, TrendingUp, TrendingDown, DollarSign, Percent, ArrowUpCircle, ArrowDownCircle, PiggyBank, Edit } from "lucide-react";
import type { Partner, PartnerTransaction } from "@shared/schema";
import { format } from "date-fns";

const partnerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().optional(),
  ownershipPercentage: z.string().min(1, "Ownership percentage is required"),
});

const transactionFormSchema = z.object({
  partnerId: z.string().min(1, "Partner is required"),
  type: z.enum(["investment", "withdrawal", "profit_distribution"]),
  amount: z.string().min(1, "Amount is required"),
  currency: z.enum(["LYD", "USD"]),
  description: z.string().optional(),
});

export default function Partners() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const { data: partnersData = [], isLoading } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
  });

  const { data: transactions = [] } = useQuery<PartnerTransaction[]>({
    queryKey: ["/api/partner-transactions"],
  });

  const partnerForm = useForm<z.infer<typeof partnerFormSchema>>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: { name: "", phone: "", email: "", ownershipPercentage: "50" },
  });

  const transactionForm = useForm<z.infer<typeof transactionFormSchema>>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: { partnerId: "", type: "investment", amount: "", currency: "LYD", description: "" },
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

  const createTransactionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof transactionFormSchema>) => {
      const res = await apiRequest("POST", "/api/partner-transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      toast({ title: t("transactionRecorded") });
      setIsTransactionDialogOpen(false);
      transactionForm.reset();
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

  const onTransactionSubmit = (data: z.infer<typeof transactionFormSchema>) => {
    createTransactionMutation.mutate(data);
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

  const totalOwnership = partnersData.reduce((sum, p) => sum + parseFloat(p.ownershipPercentage), 0);

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
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-partners-title">
          <Users className="w-6 h-6" />
          {t("partners")}
        </h1>
        <div className="flex gap-2">
          <Button onClick={openAddPartner} data-testid="button-add-partner">
            <Plus className="w-4 h-4 mr-2" />
            {t("addPartner")}
          </Button>
          <Button variant="outline" onClick={() => setIsTransactionDialogOpen(true)} data-testid="button-add-transaction" disabled={partnersData.length === 0}>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : partnersData.length === 0 ? (
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
              {transactions.length === 0 ? (
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
                      {transactions.map((tx) => (
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

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recordTransaction")}</DialogTitle>
          </DialogHeader>
          <Form {...transactionForm}>
            <form onSubmit={transactionForm.handleSubmit(onTransactionSubmit)} className="space-y-4">
              <FormField control={transactionForm.control} name="partnerId" render={({ field }) => (
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
              <FormField control={transactionForm.control} name="type" render={({ field }) => (
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
              <FormField control={transactionForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("amount")}</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} data-testid="input-tx-amount" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={transactionForm.control} name="currency" render={({ field }) => (
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
              <FormField control={transactionForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl><Textarea {...field} data-testid="input-tx-description" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createTransactionMutation.isPending} data-testid="button-submit-transaction">
                {t("recordTransaction")}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
