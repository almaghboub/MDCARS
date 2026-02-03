import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, DollarSign, Wallet, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Expense, Safe, Bank } from "@shared/schema";

export default function Expenses() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "LYD">("USD");
  const [sourceType, setSourceType] = useState<"safe" | "bank" | "external_party">("safe");
  const [sourceId, setSourceId] = useState<string>("");
  const [personName, setPersonName] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: safes = [] } = useQuery<Safe[]>({
    queryKey: ["/api/safes"],
  });

  const { data: banks = [] } = useQuery<Bank[]>({
    queryKey: ["/api/banks"],
  });

  const { data: settings = [] } = useQuery<Array<{ id: string; key: string; value: string }>>({
    queryKey: ["/api/settings"],
  });

  const lydExchangeRate = parseFloat(settings.find(s => s.key === 'lyd_exchange_rate')?.value || '4.85');

  const createExpenseMutation = useMutation({
    mutationFn: async (data: {
      category: string;
      amount: string;
      currency: string;
      sourceType: string;
      sourceId?: string;
      personName: string;
      description?: string;
      date: string;
      amountLYD?: string;
      exchangeRate?: string;
      entryType: string;
      debitAccountType: string;
      debitAccountId: string;
      creditAccountType: string;
      creditAccountId: string;
    }) => {
      return await apiRequest("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/safes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      toast({
        title: t('success'),
        description: isRTL ? 'تم إضافة المصروف بنجاح' : 'Expense added successfully',
      });
      setIsAddModalOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: t('error'),
        description: isRTL ? 'فشل في إضافة المصروف' : 'Failed to add expense',
        variant: "destructive",
      });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: t('success'),
        description: isRTL ? 'تم حذف المصروف بنجاح' : 'Expense deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: isRTL ? 'فشل في حذف المصروف' : 'Failed to delete expense',
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedCategory("");
    setAmount("");
    setCurrency("USD");
    setSourceType("safe");
    setSourceId("");
    setPersonName("");
    setDescription("");
    setExpenseDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCategory || !amount || !personName) {
      toast({
        title: t('validationError'),
        description: isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields',
        variant: "destructive",
      });
      return;
    }

    if ((sourceType === 'safe' || sourceType === 'bank') && !sourceId) {
      toast({
        title: t('validationError'),
        description: isRTL ? 'يرجى اختيار مصدر الأموال' : 'Please select a fund source',
        variant: "destructive",
      });
      return;
    }

    const amountNum = parseFloat(amount);
    const amountLYD = currency === 'USD' ? (amountNum * lydExchangeRate).toFixed(2) : amount;

    createExpenseMutation.mutate({
      category: selectedCategory,
      amount: amount,
      currency: currency,
      sourceType: sourceType,
      sourceId: sourceId || undefined,
      personName: personName,
      description: description || undefined,
      date: expenseDate,
      amountLYD: amountLYD,
      exchangeRate: lydExchangeRate.toString(),
      entryType: 'debit',
      debitAccountType: 'expense',
      debitAccountId: selectedCategory,
      creditAccountType: sourceType,
      creditAccountId: sourceId || 'external',
    });
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: Record<string, { en: string; ar: string }> = {
      employee_salaries: { en: 'Employee Salaries', ar: 'رواتب الموظفين' },
      supplier_expenses: { en: 'Supplier Expenses', ar: 'مصاريف الموردين' },
      marketing_commission: { en: 'Marketing Commission', ar: 'عمولة التسويق' },
      rent: { en: 'Rent', ar: 'الإيجار' },
      cleaning_salaries: { en: 'Cleaning Salaries', ar: 'رواتب النظافة' },
      other: { en: 'Other', ar: 'أخرى' },
    };
    return isRTL ? categoryMap[category]?.ar || category : categoryMap[category]?.en || category;
  };

  const getSourceTypeLabel = (type: string) => {
    const typeMap: Record<string, { en: string; ar: string }> = {
      safe: { en: 'Cashbox', ar: 'الخزنة' },
      bank: { en: 'Bank', ar: 'البنك' },
      external_party: { en: 'External Party', ar: 'طرف خارجي' },
    };
    return isRTL ? typeMap[type]?.ar || type : typeMap[type]?.en || type;
  };

  const getSourceName = (expense: Expense) => {
    if (expense.sourceType === 'safe' && expense.sourceId) {
      const safe = safes.find(s => s.id === expense.sourceId);
      return safe?.name || expense.sourceId;
    }
    if (expense.sourceType === 'bank' && expense.sourceId) {
      const bank = banks.find(b => b.id === expense.sourceId);
      return bank?.name || expense.sourceId;
    }
    return isRTL ? 'طرف خارجي' : 'External';
  };

  const totalExpensesUSD = expenses.reduce((sum, expense) => {
    if (expense.currency === 'USD') {
      return sum + parseFloat(expense.amount);
    }
    return sum + (parseFloat(expense.amount) / lydExchangeRate);
  }, 0);

  const totalExpensesLYD = expenses.reduce((sum, expense) => {
    if (expense.currency === 'LYD') {
      return sum + parseFloat(expense.amount);
    }
    return sum + (parseFloat(expense.amount) * lydExchangeRate);
  }, 0);

  const expensesByCategory = expenses.reduce((acc, expense) => {
    const category = expense.category;
    if (!acc[category]) {
      acc[category] = 0;
    }
    if (expense.currency === 'USD') {
      acc[category] += parseFloat(expense.amount);
    } else {
      acc[category] += parseFloat(expense.amount) / lydExchangeRate;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{isRTL ? 'المصروفات' : 'Expenses'}</h1>
          <p className="text-muted-foreground">{isRTL ? 'إدارة جميع المصروفات مع تتبع مصدر الأموال' : 'Manage all expenses with fund source tracking'}</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense">
              <Plus className="h-4 w-4 mx-2" />
              {isRTL ? 'إضافة مصروف' : 'Add Expense'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" data-testid="modal-add-expense">
            <DialogHeader>
              <DialogTitle>{isRTL ? 'إضافة مصروف جديد' : 'Add New Expense'}</DialogTitle>
              <DialogDescription>{isRTL ? 'أدخل تفاصيل المصروف ومصدر الأموال' : 'Enter expense details and fund source'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{isRTL ? 'العملة' : 'Currency'} *</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as "USD" | "LYD")}>
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="LYD">LYD (د.ل)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{isRTL ? 'المبلغ' : 'Amount'} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={currency === 'USD' ? '$0.00' : '0.00 د.ل'}
                    data-testid="input-amount"
                    required
                  />
                </div>
              </div>

              <div>
                <Label>{isRTL ? 'مصدر الأموال' : 'Fund Source'} *</Label>
                <Select value={sourceType} onValueChange={(v) => { setSourceType(v as any); setSourceId(""); }}>
                  <SelectTrigger data-testid="select-source-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="safe">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        {isRTL ? 'الخزنة' : 'Cashbox'}
                      </div>
                    </SelectItem>
                    <SelectItem value="bank">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {isRTL ? 'البنك' : 'Bank'}
                      </div>
                    </SelectItem>
                    <SelectItem value="external_party">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {isRTL ? 'طرف خارجي' : 'External Party'}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sourceType === 'safe' && (
                <div>
                  <Label>{isRTL ? 'اختر الخزنة' : 'Select Cashbox'} *</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger data-testid="select-safe">
                      <SelectValue placeholder={isRTL ? 'اختر خزنة...' : 'Select cashbox...'} />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {safes.filter(s => s.isActive).map(safe => (
                        <SelectItem key={safe.id} value={safe.id}>
                          {safe.name} ({currency === 'USD' ? `$${parseFloat(safe.balanceUSD || '0').toFixed(2)}` : `${parseFloat(safe.balanceLYD || '0').toFixed(2)} LYD`})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {sourceType === 'bank' && (
                <div>
                  <Label>{isRTL ? 'اختر البنك' : 'Select Bank'} *</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger data-testid="select-bank">
                      <SelectValue placeholder={isRTL ? 'اختر بنك...' : 'Select bank...'} />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {banks.filter(b => b.isActive).map(bank => (
                        <SelectItem key={bank.id} value={bank.id}>
                          {bank.name} ({currency === 'USD' ? `$${parseFloat(bank.balanceUSD || '0').toFixed(2)}` : `${parseFloat(bank.balanceLYD || '0').toFixed(2)} LYD`})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>{isRTL ? 'نوع المصروف' : 'Expense Category'} *</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder={isRTL ? 'اختر نوع...' : 'Select category...'} />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="employee_salaries">{isRTL ? 'رواتب الموظفين' : 'Employee Salaries'}</SelectItem>
                    <SelectItem value="supplier_expenses">{isRTL ? 'مصاريف الموردين' : 'Supplier Expenses'}</SelectItem>
                    <SelectItem value="marketing_commission">{isRTL ? 'عمولة التسويق' : 'Marketing Commission'}</SelectItem>
                    <SelectItem value="rent">{isRTL ? 'الإيجار' : 'Rent'}</SelectItem>
                    <SelectItem value="cleaning_salaries">{isRTL ? 'رواتب النظافة' : 'Cleaning Salaries'}</SelectItem>
                    <SelectItem value="other">{isRTL ? 'أخرى' : 'Other'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{isRTL ? 'اسم المستلم' : 'Recipient Name'} *</Label>
                <Input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder={isRTL ? 'أدخل اسم المستلم' : 'Enter recipient name'}
                  data-testid="input-person-name"
                  required
                />
              </div>

              <div>
                <Label>{isRTL ? 'التاريخ' : 'Date'} *</Label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  data-testid="input-date"
                  required
                />
              </div>

              <div>
                <Label>{isRTL ? 'الوصف (اختياري)' : 'Description (Optional)'}</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[80px] p-3 border rounded-md resize-none"
                  placeholder={isRTL ? 'أضف وصفاً...' : 'Add description...'}
                  data-testid="textarea-description"
                />
              </div>

              {amount && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    {isRTL ? 'المعادل:' : 'Equivalent:'}
                  </div>
                  <div className="font-semibold">
                    {currency === 'USD' 
                      ? `${(parseFloat(amount) * lydExchangeRate).toFixed(2)} LYD`
                      : `$${(parseFloat(amount) / lydExchangeRate).toFixed(2)}`
                    }
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  data-testid="button-cancel"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                  data-testid="button-submit"
                >
                  {createExpenseMutation.isPending 
                    ? (isRTL ? 'جاري الإضافة...' : 'Adding...') 
                    : (isRTL ? 'إضافة مصروف' : 'Add Expense')
                  }
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isRTL ? 'إجمالي المصروفات (USD)' : 'Total Expenses (USD)'}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-usd">
              ${totalExpensesUSD.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isRTL ? 'إجمالي المصروفات (LYD)' : 'Total Expenses (LYD)'}</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-total-lyd">
              {totalExpensesLYD.toFixed(2)} LYD
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isRTL ? 'عدد المصروفات' : 'Total Transactions'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-count">
              {expenses.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isRTL ? 'أعلى فئة' : 'Top Category'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold" data-testid="text-top-category">
              {Object.entries(expensesByCategory).length > 0
                ? getCategoryLabel(Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || '')
                : (isRTL ? 'لا يوجد' : 'None')
              }
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'قائمة المصروفات' : 'Expenses List'}</CardTitle>
          <CardDescription>{isRTL ? 'جميع المصروفات مع مصدر الأموال' : 'All expenses with fund source tracking'}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{isRTL ? 'لا توجد مصروفات' : 'No expenses found'}</p>
              <p className="text-sm mt-2">{isRTL ? 'ابدأ بإضافة أول مصروف' : 'Start by adding your first expense'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الرقم' : 'Number'}</TableHead>
                    <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{isRTL ? 'الفئة' : 'Category'}</TableHead>
                    <TableHead>{isRTL ? 'المستلم' : 'Recipient'}</TableHead>
                    <TableHead>{isRTL ? 'المصدر' : 'Source'}</TableHead>
                    <TableHead className="text-right">{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                    <TableHead className="text-right">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                      <TableCell className="font-mono text-sm">
                        {expense.expenseNumber || '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(expense.date).toLocaleDateString(isRTL ? 'ar-LY' : 'en-US')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>
                      </TableCell>
                      <TableCell>{expense.personName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {expense.sourceType === 'safe' && <Wallet className="h-3 w-3" />}
                          {expense.sourceType === 'bank' && <Building2 className="h-3 w-3" />}
                          {expense.sourceType === 'external_party' && <Users className="h-3 w-3" />}
                          <span className="text-sm">{getSourceName(expense)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <div className={expense.currency === 'LYD' ? 'font-bold text-blue-600' : 'font-bold'}>
                            {expense.currency === 'USD' ? '$' : ''}{parseFloat(expense.amount).toFixed(2)} {expense.currency === 'LYD' ? 'LYD' : ''}
                          </div>
                          {expense.amountLYD && expense.currency === 'USD' && (
                            <div className="text-xs text-blue-600">
                              {parseFloat(expense.amountLYD).toFixed(2)} LYD
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteExpenseMutation.mutate(expense.id)}
                          data-testid={`button-delete-${expense.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
    </div>
  );
}
