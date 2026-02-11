import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Printer, RotateCcw, FileText } from "lucide-react";
import { format } from "date-fns";
import type { SaleWithDetails } from "@shared/schema";

interface SaleInvoiceDialogProps {
  sale: SaleWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaleInvoiceDialog({ sale, open, onOpenChange }: SaleInvoiceDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);

  const returnMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const res = await apiRequest("POST", `/api/sales/${saleId}/return`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: t("saleReturned") });
      setShowReturnConfirm(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!sale) return null;

  const profit = sale.items?.reduce((sum, item) => sum + parseFloat(item.profit || "0"), 0) || 0;

  const handlePrint = () => {
    window.print();
  };

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-invoice-title">
              <FileText className="w-5 h-5" />
              {t("invoiceDetails")} - {sale.saleNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="invoice-container space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">{t("saleNumber")}</p>
                <p className="font-bold">{sale.saleNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("date")}</p>
                <p className="font-medium">{format(new Date(sale.createdAt), "PPp")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("customer")}</p>
                <p className="font-medium">{sale.customer?.name || t("walkin")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("soldBy")}</p>
                <p className="font-medium">{sale.createdBy?.firstName} {sale.createdBy?.lastName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("status")}</p>
                <Badge variant={statusColor(sale.status) as any}>{statusLabel(sale.status)}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("paymentMethod")}</p>
                <p className="font-medium">{sale.paymentMethod === "cash" ? t("cash") : t("partial")}</p>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-2">{t("itemsList")}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead>{t("sku")}</TableHead>
                    <TableHead className="text-center">{t("quantity")}</TableHead>
                    <TableHead>{t("unitPrice")}</TableHead>
                    <TableHead>{t("totalPrice")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items?.map((item) => (
                    <TableRow key={item.id} data-testid={`invoice-item-${item.id}`}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.productSku}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell>{item.unitPrice} {sale.currency}</TableCell>
                      <TableCell className="font-bold">{item.totalPrice} {sale.currency}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span>{sale.subtotal} {sale.currency}</span>
              </div>
              {parseFloat(sale.discount) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>{t("discount")}</span>
                  <span>-{sale.discount} {sale.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>{t("total")}</span>
                <span>{sale.totalAmount} {sale.currency}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>{t("paid")}</span>
                <span>{sale.amountPaid} {sale.currency}</span>
              </div>
              {parseFloat(sale.amountDue) > 0 && (
                <div className="flex justify-between text-orange-600 font-bold">
                  <span>{t("amountDue")}</span>
                  <span>{sale.amountDue} {sale.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-green-700">
                <span>{t("profit")}</span>
                <span>{profit.toFixed(2)} {sale.currency}</span>
              </div>
            </div>

            {sale.notes && (
              <div className="p-3 bg-muted rounded">
                <p className="text-sm text-muted-foreground">{t("notes")}</p>
                <p>{sale.notes}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={handlePrint} data-testid="button-print-invoice">
                <Printer className="w-4 h-4 mr-2" />
                {t("printInvoice")}
              </Button>
              {sale.status === "completed" && (
                <Button
                  variant="destructive"
                  onClick={() => setShowReturnConfirm(true)}
                  disabled={returnMutation.isPending}
                  data-testid="button-return-sale"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {returnMutation.isPending ? t("returnProcessing") : t("returnSale")}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showReturnConfirm} onOpenChange={setShowReturnConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-return-confirm-title">{t("returnConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("returnConfirmMessage")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-return-cancel">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sale && returnMutation.mutate(sale.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-return-confirm"
            >
              {t("returnSale")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
