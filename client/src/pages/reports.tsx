import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Package, DollarSign, Calendar, Download, Eye, Wrench } from "lucide-react";
import type { SaleWithDetails } from "@shared/schema";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths, subDays } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { SaleInvoiceDialog } from "@/components/sale-invoice-dialog";

interface BestSeller {
  productId: string;
  productName: string;
  totalSold: number;
  totalRevenue: number;
}

interface PeriodReport {
  totalSales: number;
  totalRevenue: number;
  totalServiceFees: number;
  totalProfit: number;
}

interface SalesSummary {
  totalSales: number;
  totalRevenue: number;
  totalServiceFees: number;
  totalProfit: number;
  averageOrderValue: number;
}

export default function Reports() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("month");
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const { data: sales = [] } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/sales"],
  });

  const { data: bestSellers = [] } = useQuery<BestSeller[]>({
    queryKey: ["/api/reports/best-sellers"],
  });

  const { data: todayReport } = useQuery<PeriodReport>({
    queryKey: ["/api/reports/daily"],
  });

  const { data: weeklyReport } = useQuery<PeriodReport>({
    queryKey: ["/api/reports/weekly"],
  });

  const now = new Date();
  const { data: monthlyReport } = useQuery<PeriodReport>({
    queryKey: ["/api/reports/monthly"],
  });

  const getDateRange = () => {
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: subDays(now, 7), end: now };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "year":
        return { start: subMonths(now, 12), end: now };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { start, end } = getDateRange();

  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt);
    return saleDate >= start && saleDate <= end;
  });

  const calculateProfit = (sale: SaleWithDetails) => {
    if (!sale.items) return 0;
    return sale.items.reduce((sum, item) => sum + parseFloat(item.profit || "0"), 0);
  };

  const summary: SalesSummary = {
    totalSales: filteredSales.length,
    totalServiceFees: filteredSales.reduce((sum, s) => sum + parseFloat(s.serviceFee || "0"), 0),
    totalRevenue: filteredSales.reduce((sum, s) => sum + parseFloat(s.totalAmount) - parseFloat(s.serviceFee || "0"), 0),
    totalProfit: filteredSales.reduce((sum, s) => sum + calculateProfit(s), 0),
    averageOrderValue: filteredSales.length > 0
      ? filteredSales.reduce((sum, s) => sum + parseFloat(s.totalAmount) - parseFloat(s.serviceFee || "0"), 0) / filteredSales.length
      : 0,
  };

  const exportToCSV = () => {
    const headers = [t("date"), t("saleNumber"), t("customer"), t("total"), t("serviceFee"), t("profit"), t("payment"), t("status")];
    const rows = filteredSales.map(sale => [
      format(new Date(sale.createdAt), "yyyy-MM-dd HH:mm"),
      sale.saleNumber,
      sale.customer?.name || t("walkin"),
      sale.totalAmount,
      sale.serviceFee || "0",
      calculateProfit(sale).toFixed(2),
      sale.paymentMethod,
      sale.status,
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case "cash": return t("cash");
      case "card": return t("creditCard");
      case "transfer": return t("moneyTransfer");
      case "credit": return t("creditSale");
      case "mixed": return t("mixed");
      default: return method;
    }
  };

  const serviceFeeInvoices = filteredSales.filter(s => parseFloat(s.serviceFee || "0") > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-reports-title">{t("reportsAnalytics")}</h1>
          <p className="text-muted-foreground">{t("salesPerformance")}</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-40" data-testid="select-period">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t("today")}</SelectItem>
              <SelectItem value="week">{t("lastSevenDays")}</SelectItem>
              <SelectItem value="month">{t("thisMonth")}</SelectItem>
              <SelectItem value="year">{t("thisYear")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportToCSV} variant="outline" data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            {t("exportCSV")}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("totalSales")}</p>
                <p className="text-2xl font-bold" data-testid="text-total-sales">{summary.totalSales}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("totalRevenue")}</p>
                <p className="text-2xl font-bold" data-testid="text-total-revenue">{summary.totalRevenue.toFixed(2)} LYD</p>
                <p className="text-xs text-muted-foreground mt-1">{t("productsTotal")}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("totalProfit")}</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-total-profit">{summary.totalProfit.toFixed(2)} LYD</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("avgOrderValue")}</p>
                <p className="text-2xl font-bold" data-testid="text-avg-order">{summary.averageOrderValue.toFixed(2)} LYD</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">{t("salesHistory")}</TabsTrigger>
          <TabsTrigger value="service-fees" className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            {t("serviceFeeReport")}
          </TabsTrigger>
          <TabsTrigger value="best-sellers">{t("bestSellers")}</TabsTrigger>
        </TabsList>

        {/* ── Sales History ── */}
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("salesHistory")} ({filteredSales.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSales.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("noSalesInPeriod")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("saleNumber")}</TableHead>
                      <TableHead>{t("soldBy")}</TableHead>
                      <TableHead>{t("customer")}</TableHead>
                      <TableHead>{t("total")}</TableHead>
                      <TableHead className="text-blue-600">{t("serviceFee")}</TableHead>
                      <TableHead>{t("profit")}</TableHead>
                      <TableHead>{t("payment")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.slice(0, 50).map((sale) => (
                      <TableRow key={sale.id} data-testid={`sale-row-${sale.id}`}>
                        <TableCell>{format(new Date(sale.createdAt), "PPp")}</TableCell>
                        <TableCell className="font-medium">{sale.saleNumber}</TableCell>
                        <TableCell>{sale.createdBy?.firstName} {sale.createdBy?.lastName}</TableCell>
                        <TableCell>{sale.customer?.name || t("walkin")}</TableCell>
                        <TableCell className="font-bold">{sale.totalAmount} {sale.currency}</TableCell>
                        <TableCell className="text-blue-600 font-medium">
                          {parseFloat(sale.serviceFee || "0") > 0
                            ? `${parseFloat(sale.serviceFee || "0").toFixed(2)} ${sale.currency}`
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-green-600">{calculateProfit(sale).toFixed(2)} LYD</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getPaymentLabel(sale.paymentMethod)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sale.status === "completed" ? "default" : sale.status === "pending" ? "secondary" : "destructive"}>
                            {sale.status === "completed" ? t("completed") : sale.status === "returned" ? t("returned") : sale.status === "cancelled" ? t("cancelled") : t("pending")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedSale(sale); setInvoiceOpen(true); }}
                            data-testid={`button-view-invoice-${sale.id}`}
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

        {/* ── Service Fee Report ── */}
        <TabsContent value="service-fees" className="space-y-6">
          {/* Note banner */}
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Wrench className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700 dark:text-blue-300">{t("serviceWorkerNote")}</p>
            </CardContent>
          </Card>

          {/* Three period cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Today */}
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Calendar className="w-4 h-4" />
                  {t("today")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-fee-today">
                  {(todayReport?.totalServiceFees ?? 0).toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">LYD</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {todayReport?.totalSales ?? 0} {t("totalSales").toLowerCase()} · {todayReport?.totalSales ?? 0} {t("feesCollected")}
                </p>
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between"><span>{t("productsTotal")}</span><span>{(todayReport?.totalRevenue ?? 0).toFixed(2)} LYD</span></div>
                  <div className="flex justify-between"><span>{t("totalProfit")}</span><span className="text-green-600">{(todayReport?.totalProfit ?? 0).toFixed(2)} LYD</span></div>
                </div>
              </CardContent>
            </Card>

            {/* This week */}
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Calendar className="w-4 h-4" />
                  {t("thisWeek")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-fee-week">
                  {(weeklyReport?.totalServiceFees ?? 0).toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">LYD</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {weeklyReport?.totalSales ?? 0} {t("totalSales").toLowerCase()}
                </p>
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between"><span>{t("productsTotal")}</span><span>{(weeklyReport?.totalRevenue ?? 0).toFixed(2)} LYD</span></div>
                  <div className="flex justify-between"><span>{t("totalProfit")}</span><span className="text-green-600">{(weeklyReport?.totalProfit ?? 0).toFixed(2)} LYD</span></div>
                </div>
              </CardContent>
            </Card>

            {/* This month */}
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Calendar className="w-4 h-4" />
                  {t("thisMonth")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-fee-month">
                  {(monthlyReport?.totalServiceFees ?? 0).toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">LYD</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {monthlyReport?.totalSales ?? 0} {t("totalSales").toLowerCase()}
                </p>
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between"><span>{t("productsTotal")}</span><span>{(monthlyReport?.totalRevenue ?? 0).toFixed(2)} LYD</span></div>
                  <div className="flex justify-between"><span>{t("totalProfit")}</span><span className="text-green-600">{(monthlyReport?.totalProfit ?? 0).toFixed(2)} LYD</span></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invoices that include a service fee, filtered by the selected period */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-500" />
                {t("serviceFeeReport")} — {t("salesHistory")} ({serviceFeeInvoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {serviceFeeInvoices.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("noSalesInPeriod")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("saleNumber")}</TableHead>
                      <TableHead>{t("soldBy")}</TableHead>
                      <TableHead>{t("customer")}</TableHead>
                      <TableHead>{t("productsTotal")}</TableHead>
                      <TableHead className="text-blue-600 font-semibold">{t("serviceFee")}</TableHead>
                      <TableHead>{t("total")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceFeeInvoices.map((sale) => {
                      const fee = parseFloat(sale.serviceFee || "0");
                      const productsAmt = parseFloat(sale.totalAmount) - fee;
                      return (
                        <TableRow key={sale.id} data-testid={`fee-row-${sale.id}`}>
                          <TableCell>{format(new Date(sale.createdAt), "PPp")}</TableCell>
                          <TableCell className="font-medium">{sale.saleNumber}</TableCell>
                          <TableCell>{sale.createdBy?.firstName} {sale.createdBy?.lastName}</TableCell>
                          <TableCell>{sale.customer?.name || t("walkin")}</TableCell>
                          <TableCell>{productsAmt.toFixed(2)} {sale.currency}</TableCell>
                          <TableCell className="font-bold text-blue-600">{fee.toFixed(2)} {sale.currency}</TableCell>
                          <TableCell className="font-bold">{sale.totalAmount} {sale.currency}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedSale(sale); setInvoiceOpen(true); }}
                              data-testid={`button-fee-invoice-${sale.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Best Sellers ── */}
        <TabsContent value="best-sellers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                {t("bestSellingProducts")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bestSellers.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("noSalesDataYet")}</p>
              ) : (
                <div className="space-y-4">
                  {bestSellers.map((item, index) => (
                    <div key={item.productId} className="flex items-center justify-between p-4 bg-muted rounded-lg" data-testid={`best-seller-${index}`}>
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-500 text-yellow-900' :
                          index === 1 ? 'bg-gray-400 text-gray-900' :
                          index === 2 ? 'bg-amber-600 text-amber-100' :
                          'bg-primary text-primary-foreground'
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-muted-foreground">ID: {item.productId.slice(0, 8)}...</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{item.totalSold} {t("sold")}</p>
                        <p className="text-sm text-muted-foreground">{item.totalRevenue.toFixed(2)} LYD {t("revenue")}</p>
                      </div>
                    </div>
                  ))}
                </div>
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
