import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Search, Eye } from "lucide-react";
import type { SaleWithDetails } from "@shared/schema";
import { format } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { SaleInvoiceDialog } from "@/components/sale-invoice-dialog";

export default function Returns() {
  const { t } = useI18n();
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: sales = [], isLoading } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/sales"],
  });

  const returnedSales = sales.filter((sale) => sale.status === "returned");

  const filteredReturns = returnedSales.filter((sale) => {
    if (searchQuery === "") return true;
    return (
      sale.saleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.createdBy?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.createdBy?.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalReturnedLYD = filteredReturns
    .filter((s) => s.currency === "LYD")
    .reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
  const totalReturnedUSD = filteredReturns
    .filter((s) => s.currency === "USD")
    .reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-returns-title">
          <RotateCcw className="w-6 h-6" />
          {t("saleReturns")}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("totalReturns")}</p>
            <p className="text-2xl font-bold text-red-600" data-testid="text-total-returns">{filteredReturns.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("returnedAmount")} (LYD)</p>
            <p className="text-2xl font-bold text-red-600" data-testid="text-returned-lyd">{totalReturnedLYD.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("returnedAmount")} (USD)</p>
            <p className="text-2xl font-bold text-red-600" data-testid="text-returned-usd">{totalReturnedUSD.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              {t("allReturns")}
            </CardTitle>
            <div className="relative flex-1 md:w-64 md:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchReturns")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-returns"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RotateCcw className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("noReturnsFound")}</p>
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
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.map((sale) => (
                    <TableRow key={sale.id} data-testid={`return-row-${sale.id}`}>
                      <TableCell className="font-bold">{sale.saleNumber}</TableCell>
                      <TableCell>{format(new Date(sale.createdAt), "PPp")}</TableCell>
                      <TableCell>{sale.customer?.name || t("walkin")}</TableCell>
                      <TableCell>{sale.createdBy?.firstName} {sale.createdBy?.lastName}</TableCell>
                      <TableCell>{sale.items?.length || 0}</TableCell>
                      <TableCell className="font-bold">{sale.totalAmount} {sale.currency}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{t("returned")}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedSale(sale); setInvoiceOpen(true); }}
                          data-testid={`button-view-return-${sale.id}`}
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

          {filteredReturns.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground border-t pt-4">
              {t("showing")} {filteredReturns.length} {t("returns")}
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
