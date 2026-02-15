import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Printer, RotateCcw, X } from "lucide-react";
import { format } from "date-fns";
import type { SaleWithDetails } from "@shared/schema";
import logoPath from "@assets/MD-removebg-preview_1770139105370.png";

interface SaleInvoiceDialogProps {
  sale: SaleWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaleInvoiceDialog({ sale, open, onOpenChange }: SaleInvoiceDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

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
    const printContent = invoiceRef.current;
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${sale.saleNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; padding: 20px; }
          .invoice-print { max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #1e40af; margin-bottom: 20px; }
          .header-left { display: flex; align-items: center; gap: 12px; }
          .header-left img { height: 60px; }
          .company-name { font-size: 24px; font-weight: 800; color: #1e40af; }
          .company-sub { font-size: 12px; color: #64748b; }
          .invoice-title { text-align: right; }
          .invoice-title h2 { font-size: 28px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 2px; }
          .invoice-number { font-size: 14px; color: #64748b; margin-top: 4px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .meta-box h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; font-weight: 600; }
          .meta-box p { font-size: 14px; color: #1a1a1a; line-height: 1.6; }
          .meta-box .value { font-weight: 600; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .items-table th { background: #1e40af; color: white; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .items-table th:first-child { border-radius: 6px 0 0 0; }
          .items-table th:last-child { border-radius: 0 6px 0 0; text-align: right; }
          .items-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .items-table td:last-child { text-align: right; font-weight: 600; }
          .items-table tr:nth-child(even) { background: #f8fafc; }
          .items-table .qty { text-align: center; }
          .items-table th.qty { text-align: center; }
          .summary { display: flex; justify-content: flex-end; margin-bottom: 20px; }
          .summary-box { width: 300px; }
          .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
          .summary-row.total { border-top: 2px solid #1e40af; padding-top: 10px; margin-top: 6px; font-size: 16px; font-weight: 800; color: #1e40af; }
          .summary-row.paid { color: #16a34a; font-weight: 600; }
          .summary-row.due { color: #ea580c; font-weight: 700; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
          .status-completed { background: #dcfce7; color: #166534; }
          .status-returned { background: #fecaca; color: #991b1b; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
          .notes-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #92400e; font-weight: 600; margin-bottom: 4px; }
          .notes p { font-size: 13px; color: #78350f; }
          .footer { text-align: center; padding-top: 20px; border-top: 2px solid #e2e8f0; }
          .footer p { font-size: 12px; color: #94a3b8; }
          .footer .thank-you { font-size: 15px; font-weight: 700; color: #1e40af; margin-bottom: 4px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
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

  const statusClass = (status: string) => {
    switch (status) {
      case "completed": return "status-completed";
      case "returned": return "status-returned";
      default: return "status-pending";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Badge variant={statusColor(sale.status) as any} className="text-xs">
                {statusLabel(sale.status)}
              </Badge>
              <span className="text-sm text-muted-foreground">{sale.saleNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-invoice">
                <Printer className="w-4 h-4 mr-2" />
                {t("printInvoice")}
              </Button>
              {sale.status === "completed" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowReturnConfirm(true)}
                  disabled={returnMutation.isPending}
                  data-testid="button-return-sale"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {returnMutation.isPending ? t("returnProcessing") : t("returnSale")}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div ref={invoiceRef} className="invoice-print p-6">
            <div className="flex items-start justify-between pb-5 mb-5" style={{ borderBottom: "3px solid #1e40af" }}>
              <div className="flex items-center gap-3">
                <img src={logoPath} alt="MD Cars" className="h-14" />
                <div>
                  <h1 className="text-2xl font-extrabold text-blue-700 tracking-tight">MD CARS</h1>
                  <p className="text-xs text-muted-foreground">Car Accessories & Parts</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-extrabold text-blue-700 tracking-widest uppercase">
                  {t("invoice")}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{sale.saleNumber}</p>
                <span className={`status-badge ${statusClass(sale.status)} inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  sale.status === "completed" ? "bg-green-100 text-green-800" :
                  sale.status === "returned" ? "bg-red-100 text-red-800" :
                  "bg-yellow-100 text-yellow-800"
                }`}>
                  {statusLabel(sale.status)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 border rounded-lg p-4">
                <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{t("invoiceDetails")}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("date")}:</span>
                    <span className="font-medium">{format(new Date(sale.createdAt), "PPp")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("paymentMethod")}:</span>
                    <span className="font-medium">{sale.paymentMethod === "cash" ? t("cash") : t("partial")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("currency")}:</span>
                    <span className="font-semibold">{sale.currency}</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 border rounded-lg p-4">
                <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{t("customerInfo")}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("customer")}:</span>
                    <span className="font-medium">{sale.customer?.name || t("walkin")}</span>
                  </div>
                  {sale.customer?.phone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("phone")}:</span>
                      <span className="font-medium">{sale.customer.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("soldBy")}:</span>
                    <span className="font-medium">{sale.createdBy?.firstName} {sale.createdBy?.lastName}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="bg-blue-700 text-white">
                    <th className="text-left py-2.5 px-3 rounded-tl-md font-semibold text-xs uppercase tracking-wider">#</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">{t("product")}</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">{t("quantity")}</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">{t("unitPrice")}</th>
                    <th className="text-right py-2.5 px-3 rounded-tr-md font-semibold text-xs uppercase tracking-wider">{t("totalPrice")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items?.map((item, index) => (
                    <tr key={item.id} data-testid={`invoice-item-${item.id}`} className={index % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-slate-50 dark:bg-slate-800/30"} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td className="py-2.5 px-3 text-muted-foreground">{index + 1}</td>
                      <td className="py-2.5 px-3 font-medium">{item.productName}</td>
                      <td className="py-2.5 px-3 text-center">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right">{item.unitPrice} {sale.currency}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">{item.totalPrice} {sale.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mb-6">
              <div className="w-72 space-y-1">
                <div className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground">{t("subtotal")}</span>
                  <span className="font-medium">{sale.subtotal} {sale.currency}</span>
                </div>
                {parseFloat(sale.discount) > 0 && (
                  <div className="flex justify-between text-sm py-1 text-red-600">
                    <span>{t("discount")}</span>
                    <span>-{sale.discount} {sale.currency}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 mt-1 font-extrabold text-lg text-blue-700" style={{ borderTop: "2px solid #1e40af" }}>
                  <span>{t("total")}</span>
                  <span>{sale.totalAmount} {sale.currency}</span>
                </div>
                <div className="flex justify-between text-sm py-1 text-green-600 font-semibold">
                  <span>{t("paid")}</span>
                  <span>{sale.amountPaid} {sale.currency}</span>
                </div>
                {parseFloat(sale.amountDue) > 0 && (
                  <div className="flex justify-between text-sm py-1 text-orange-600 font-bold">
                    <span>{t("amountDue")}</span>
                    <span>{sale.amountDue} {sale.currency}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm py-1 text-green-700 font-semibold" style={{ borderTop: "1px solid #e2e8f0" }}>
                  <span>{t("profit")}</span>
                  <span>{profit.toFixed(2)} {sale.currency}</span>
                </div>
              </div>
            </div>

            {sale.notes && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                <p className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">{t("notes")}</p>
                <p className="text-sm text-amber-900 dark:text-amber-300">{sale.notes}</p>
              </div>
            )}

            <div className="text-center pt-5" style={{ borderTop: "2px solid #e2e8f0" }}>
              <p className="text-sm font-bold text-blue-700 mb-1">{t("thankYou")}</p>
              <p className="text-xs text-muted-foreground">MD CARS - Car Accessories & Parts</p>
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
