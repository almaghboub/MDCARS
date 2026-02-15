import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Eye, Filter } from "lucide-react";
import type { SaleWithDetails } from "@shared/schema";
import { format } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { SaleInvoiceDialog } from "@/components/sale-invoice-dialog";

export default function Invoices() {
  const { t } = useI18n();
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: sales = [], isLoading } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/sales"],
  });

  const nonReturnedSales = sales.filter((sale) => sale.status !== "returned");

  const filteredSales = nonReturnedSales.filter((sale) => {
    const matchesSearch =
      searchQuery === "" ||
      sale.saleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.createdBy?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.createdBy?.lastName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || sale.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalLYD = filteredSales
    .filter((s) => s.currency === "LYD" && s.status === "completed")
    .reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
  const totalUSD = filteredSales
    .filter((s) => s.currency === "USD" && s.status === "completed")
    .reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
  const totalProfit = filteredSales
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => {
      const saleProfit = s.items?.reduce((p, item) => p + parseFloat(item.profit || "0"), 0) || 0;
      return sum + saleProfit;
    }, 0);

  const completedCount = filteredSales.filter((s) => s.status === "completed").length;
  const pendingCount = filteredSales.filter((s) => s.status === "pending").length;

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "returned": return "destructive";
      case "cancelled": return "destructive";
      case "pending": return "secondary";
      default: return "outline";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed": return t("completed");
      case "returned": return t("returned");
      case "cancelled": return t("cancelled");
      case "pending": return t("pending");
      default: return status;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-invoices-title">
          <FileText className="w-6 h-6" />
          {t("invoiceHistory")}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("totalSales")}</p>
            <p className="text-2xl font-bold" data-testid="text-total-invoices">{filteredSales.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("completed")}</p>
            <p className="text-2xl font-bold text-green-600" data-testid="text-completed-count">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("totalRevenue")} (LYD)</p>
            <p className="text-2xl font-bold" data-testid="text-total-lyd">{totalLYD.toFixed(2)}</p>
            {totalUSD > 0 && <p className="text-sm text-muted-foreground">${totalUSD.toFixed(2)} USD</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("profit")}</p>
            <p className="text-2xl font-bold text-green-600" data-testid="text-total-profit">{totalProfit.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t("allInvoices")}
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchInvoices")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-invoices"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStatuses")}</SelectItem>
                  <SelectItem value="completed">{t("completed")}</SelectItem>
                  <SelectItem value="pending">{t("pending")}</SelectItem>
                  <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("noInvoicesFound")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("saleNumber")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("customer")}</TableHead>
                    <TableHead>{t("soldBy")}</TableHead>
                    <TableHead>{t("items")}</TableHead>
                    <TableHead>{t("total")}</TableHead>
                    <TableHead>{t("paid")}</TableHead>
                    <TableHead>{t("amountDue")}</TableHead>
                    <TableHead>{t("payment")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} data-testid={`invoice-row-${sale.id}`}>
                      <TableCell className="font-bold">{sale.saleNumber}</TableCell>
                      <TableCell>{format(new Date(sale.createdAt), "PPp")}</TableCell>
                      <TableCell>{sale.customer?.name || t("walkin")}</TableCell>
                      <TableCell>{sale.createdBy?.firstName} {sale.createdBy?.lastName}</TableCell>
                      <TableCell>{sale.items?.length || 0}</TableCell>
                      <TableCell className="font-bold">{sale.totalAmount} {sale.currency}</TableCell>
                      <TableCell className="text-green-600">{sale.amountPaid} {sale.currency}</TableCell>
                      <TableCell className={parseFloat(sale.amountDue) > 0 ? "text-orange-600 font-bold" : ""}>
                        {parseFloat(sale.amountDue) > 0 ? `${sale.amountDue} ${sale.currency}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.paymentMethod === "cash" ? "secondary" : "outline"}>
                          {sale.paymentMethod === "cash" ? t("cash") : t("partial")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(sale.status) as any}>
                          {statusLabel(sale.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedSale(sale); setInvoiceOpen(true); }}
                          data-testid={`button-view-invoice-${sale.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {t("viewInvoice")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredSales.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
              <span>{t("showing")} {filteredSales.length} {t("invoicesOf")} {nonReturnedSales.length}</span>
              <div className="flex gap-4">
                <span>{t("completed")}: {completedCount}</span>
                <span>{t("pending")}: {pendingCount}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SaleInvoiceDialog
        sale={selectedSale}
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
      />
    </div>
  );
}
