import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Package, DollarSign, Calendar, Download, Eye } from "lucide-react";
import type { Sale, SaleWithDetails } from "@shared/schema";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths, subDays } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { SaleInvoiceDialog } from "@/components/sale-invoice-dialog";

interface DailySalesReport {
  date: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
}

interface BestSeller {
  productId: string;
  productName: string;
  totalSold: number;
  totalRevenue: number;
}

interface SalesSummary {
  totalSales: number;
  totalRevenue: number;
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

  const { data: dailyReport = [] } = useQuery<DailySalesReport[]>({
    queryKey: ["/api/reports/daily", period],
  });

  const getDateRange = () => {
    const now = new Date();
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
    totalRevenue: filteredSales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0),
    totalProfit: filteredSales.reduce((sum, s) => sum + calculateProfit(s), 0),
    averageOrderValue: filteredSales.length > 0 
      ? filteredSales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0) / filteredSales.length 
      : 0,
  };

  const exportToCSV = () => {
    const headers = [t("date"), t("saleNumber"), t("customer"), t("total"), t("profit"), t("payment"), t("status")];
    const rows = filteredSales.map(sale => [
      format(new Date(sale.createdAt), "yyyy-MM-dd HH:mm"),
      sale.saleNumber,
      sale.customer?.name || t("walkin"),
      sale.totalAmount,
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <TabsTrigger value="best-sellers">{t("bestSellers")}</TabsTrigger>
          <TabsTrigger value="daily">{t("dailySummary")}</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("salesHistory")} ({filteredSales.length} sales)</CardTitle>
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
                      <TableHead>{t("items")}</TableHead>
                      <TableHead>{t("total")}</TableHead>
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
                        <TableCell>{sale.items?.length || 0}</TableCell>
                        <TableCell className="font-bold">{sale.totalAmount} {sale.currency}</TableCell>
                        <TableCell className="text-green-600">{calculateProfit(sale).toFixed(2)} LYD</TableCell>
                        <TableCell>
                          <Badge variant={sale.paymentMethod === "cash" ? "secondary" : "outline"}>
                            {sale.paymentMethod === "cash" ? t("cash") : t("partial")}
                          </Badge>
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

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("dailySummary")}</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyReport.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("dailySalesData")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("totalSales")}</TableHead>
                      <TableHead>{t("revenue")}</TableHead>
                      <TableHead>{t("profit")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyReport.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">{format(new Date(day.date), "PPP")}</TableCell>
                        <TableCell>{day.totalSales}</TableCell>
                        <TableCell>{day.totalRevenue.toFixed(2)} LYD</TableCell>
                        <TableCell className="text-green-600">{day.totalProfit.toFixed(2)} LYD</TableCell>
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
