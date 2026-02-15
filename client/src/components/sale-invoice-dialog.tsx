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
      setShowReturnConfirm(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: t("saleReturned") });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const profit = sale?.items?.reduce((sum, item) => sum + parseFloat(item.profit || "0"), 0) || 0;

  if (!sale) return null;

  const printStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; background: white; }
    .invoice-wrapper { max-width: 800px; margin: 0 auto; padding: 0; }

    .invoice-header {
      background: linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%);
      color: white;
      padding: 30px 35px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-brand { display: flex; align-items: center; gap: 14px; }
    .header-brand img { height: 65px; filter: brightness(1.2); }
    .brand-text h1 { font-size: 28px; font-weight: 900; letter-spacing: 3px; color: #fff; }
    .brand-text p { font-size: 11px; color: #93c5fd; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
    .header-right { text-align: right; }
    .header-right .invoice-label { font-size: 32px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; color: #60a5fa; }
    .header-right .invoice-num { font-size: 13px; color: #93c5fd; margin-top: 4px; font-weight: 500; }

    .blue-bar { height: 4px; background: linear-gradient(90deg, #2563eb, #60a5fa, #2563eb); }

    .invoice-body { padding: 28px 35px; }

    .info-row { display: flex; gap: 20px; margin-bottom: 24px; }
    .info-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .info-card-header { background: #f0f4ff; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; }
    .info-card-header h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #1e3a5f; }
    .info-card-body { padding: 14px 16px; }
    .info-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .info-line .label { color: #64748b; }
    .info-line .value { font-weight: 600; color: #1e293b; }

    .items-section { margin-bottom: 24px; }
    .items-table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    .items-table thead th { background: linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%); color: white; padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .items-table thead th:first-child { text-align: center; width: 40px; }
    .items-table thead th:nth-child(3) { text-align: center; }
    .items-table thead th:nth-child(4), .items-table thead th:last-child { text-align: right; }
    .items-table tbody td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .items-table tbody td:first-child { text-align: center; color: #94a3b8; font-size: 12px; }
    .items-table tbody td:nth-child(2) { font-weight: 600; color: #1e293b; }
    .items-table tbody td:nth-child(3) { text-align: center; }
    .items-table tbody td:nth-child(4) { text-align: right; color: #475569; }
    .items-table tbody td:last-child { text-align: right; font-weight: 700; color: #1e293b; }
    .items-table tbody tr:nth-child(even) { background: #f8fafc; }
    .items-table tbody tr:last-child td { border-bottom: none; }

    .totals-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
    .totals-box { width: 320px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .total-row { display: flex; justify-content: space-between; padding: 10px 18px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .total-row .label { color: #64748b; }
    .total-row .value { font-weight: 600; }
    .total-row.discount .value { color: #ef4444; }
    .total-row.grand-total { background: linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%); border-bottom: none; }
    .total-row.grand-total .label { color: #93c5fd; font-weight: 700; font-size: 15px; text-transform: uppercase; letter-spacing: 1px; }
    .total-row.grand-total .value { color: #fff; font-weight: 900; font-size: 18px; }
    .total-row.paid .value { color: #16a34a; font-weight: 700; }
    .total-row.due .value { color: #ea580c; font-weight: 700; }

    .status-pill { display: inline-block; padding: 5px 16px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .status-completed { background: #dcfce7; color: #166534; }
    .status-returned { background: #fecaca; color: #991b1b; }
    .status-pending { background: #fef3c7; color: #92400e; }

    .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; }
    .notes-box .notes-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #92400e; font-weight: 700; margin-bottom: 6px; }
    .notes-box p { font-size: 13px; color: #78350f; }

    .invoice-footer {
      text-align: center;
      padding: 20px 35px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .footer-thank { font-size: 16px; font-weight: 800; color: #1e3a5f; margin-bottom: 4px; }
    .footer-company { font-size: 12px; color: #64748b; letter-spacing: 1px; }
    .footer-line { width: 60px; height: 3px; background: linear-gradient(90deg, #2563eb, #60a5fa); margin: 10px auto 0; border-radius: 2px; }

    @media print {
      body { padding: 0; margin: 0; }
      .invoice-wrapper { max-width: 100%; }
    }
  `;

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
        <style>${printStyles}</style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
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

          <div ref={invoiceRef} className="invoice-wrapper">
            <div className="invoice-header" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%)", color: "white", padding: "30px 35px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="header-brand" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <img src={logoPath} alt="MD Cars" style={{ height: "65px", filter: "brightness(1.2)" }} />
                <div className="brand-text">
                  <h1 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "3px", color: "#fff", margin: 0 }}>MD CARS</h1>
                  <p style={{ fontSize: "11px", color: "#93c5fd", letterSpacing: "2px", textTransform: "uppercase", marginTop: "2px" }}>Car Accessories & Parts</p>
                </div>
              </div>
              <div className="header-right" style={{ textAlign: "right" }}>
                <div className="invoice-label" style={{ fontSize: "32px", fontWeight: 900, letterSpacing: "4px", textTransform: "uppercase", color: "#60a5fa" }}>
                  {t("invoice")}
                </div>
                <div className="invoice-num" style={{ fontSize: "13px", color: "#93c5fd", marginTop: "4px", fontWeight: 500 }}>
                  {sale.saleNumber}
                </div>
                <div style={{ marginTop: "8px" }}>
                  <span className={`status-pill ${statusClass(sale.status)}`} style={{
                    display: "inline-block",
                    padding: "5px 16px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    ...(sale.status === "completed" ? { background: "#dcfce7", color: "#166534" } :
                      sale.status === "returned" ? { background: "#fecaca", color: "#991b1b" } :
                      { background: "#fef3c7", color: "#92400e" })
                  }}>
                    {statusLabel(sale.status)}
                  </span>
                </div>
              </div>
            </div>

            <div className="blue-bar" style={{ height: "4px", background: "linear-gradient(90deg, #2563eb, #60a5fa, #2563eb)" }} />

            <div className="invoice-body" style={{ padding: "28px 35px" }}>
              <div className="info-row" style={{ display: "flex", gap: "20px", marginBottom: "24px" }}>
                <div className="info-card" style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                  <div className="info-card-header" style={{ background: "#f0f4ff", padding: "10px 16px", borderBottom: "1px solid #e2e8f0" }}>
                    <h4 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#1e3a5f", margin: 0 }}>{t("invoiceDetails")}</h4>
                  </div>
                  <div className="info-card-body" style={{ padding: "14px 16px" }}>
                    <div className="info-line" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "13px" }}>
                      <span className="label" style={{ color: "#64748b" }}>{t("date")}</span>
                      <span className="value" style={{ fontWeight: 600, color: "#1e293b" }}>{format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <div className="info-line" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "13px" }}>
                      <span className="label" style={{ color: "#64748b" }}>{t("paymentMethod")}</span>
                      <span className="value" style={{ fontWeight: 600, color: "#1e293b" }}>{sale.paymentMethod === "cash" ? t("cash") : t("partial")}</span>
                    </div>
                    <div className="info-line" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "13px" }}>
                      <span className="label" style={{ color: "#64748b" }}>{t("currency")}</span>
                      <span className="value" style={{ fontWeight: 600, color: "#1e293b" }}>{sale.currency}</span>
                    </div>
                  </div>
                </div>

                <div className="info-card" style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                  <div className="info-card-header" style={{ background: "#f0f4ff", padding: "10px 16px", borderBottom: "1px solid #e2e8f0" }}>
                    <h4 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#1e3a5f", margin: 0 }}>{t("customerInfo")}</h4>
                  </div>
                  <div className="info-card-body" style={{ padding: "14px 16px" }}>
                    <div className="info-line" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "13px" }}>
                      <span className="label" style={{ color: "#64748b" }}>{t("customer")}</span>
                      <span className="value" style={{ fontWeight: 600, color: "#1e293b" }}>{sale.customer?.name || t("walkin")}</span>
                    </div>
                    {sale.customer?.phone && (
                      <div className="info-line" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "13px" }}>
                        <span className="label" style={{ color: "#64748b" }}>{t("phone")}</span>
                        <span className="value" style={{ fontWeight: 600, color: "#1e293b" }}>{sale.customer.phone}</span>
                      </div>
                    )}
                    <div className="info-line" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "13px" }}>
                      <span className="label" style={{ color: "#64748b" }}>{t("soldBy")}</span>
                      <span className="value" style={{ fontWeight: 600, color: "#1e293b" }}>{sale.createdBy?.firstName} {sale.createdBy?.lastName}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="items-section" style={{ marginBottom: "24px" }}>
                <table className="items-table" style={{ width: "100%", borderCollapse: "collapse", borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                  <thead>
                    <tr>
                      <th style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%)", color: "white", padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", textAlign: "center", width: "40px" }}>#</th>
                      <th style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%)", color: "white", padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", textAlign: "left" }}>{t("product")}</th>
                      <th style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%)", color: "white", padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", textAlign: "center" }}>{t("quantity")}</th>
                      <th style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%)", color: "white", padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", textAlign: "right" }}>{t("unitPrice")}</th>
                      <th style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%)", color: "white", padding: "12px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", textAlign: "right" }}>{t("totalPrice")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items?.map((item, index) => (
                      <tr key={item.id} data-testid={`invoice-item-${item.id}`} style={{ background: index % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                        <td style={{ padding: "12px 16px", fontSize: "12px", textAlign: "center", color: "#94a3b8", borderBottom: "1px solid #f1f5f9" }}>{index + 1}</td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600, color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}>{item.productName}</td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>{item.quantity}</td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", textAlign: "right", color: "#475569", borderBottom: "1px solid #f1f5f9" }}>{parseFloat(item.unitPrice).toFixed(2)} {sale.currency}</td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", textAlign: "right", fontWeight: 700, color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}>{parseFloat(item.totalPrice).toFixed(2)} {sale.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="totals-section" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
                <div className="totals-box" style={{ width: "320px", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                  <div className="total-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", fontSize: "13px", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ color: "#64748b" }}>{t("subtotal")}</span>
                    <span style={{ fontWeight: 600 }}>{parseFloat(sale.subtotal).toFixed(2)} {sale.currency}</span>
                  </div>
                  {parseFloat(sale.discount) > 0 && (
                    <div className="total-row discount" style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", fontSize: "13px", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ color: "#64748b" }}>{t("discount")}</span>
                      <span style={{ fontWeight: 600, color: "#ef4444" }}>-{parseFloat(sale.discount).toFixed(2)} {sale.currency}</span>
                    </div>
                  )}
                  <div className="total-row grand-total" style={{ display: "flex", justifyContent: "space-between", padding: "14px 18px", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2341 100%)" }}>
                    <span style={{ color: "#93c5fd", fontWeight: 700, fontSize: "15px", textTransform: "uppercase", letterSpacing: "1px" }}>{t("total")}</span>
                    <span style={{ color: "#fff", fontWeight: 900, fontSize: "18px" }}>{parseFloat(sale.totalAmount).toFixed(2)} {sale.currency}</span>
                  </div>
                  <div className="total-row paid" style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", fontSize: "13px", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ color: "#64748b" }}>{t("paid")}</span>
                    <span style={{ fontWeight: 700, color: "#16a34a" }}>{parseFloat(sale.amountPaid).toFixed(2)} {sale.currency}</span>
                  </div>
                  {parseFloat(sale.amountDue) > 0 && (
                    <div className="total-row due" style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", fontSize: "13px", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ color: "#64748b" }}>{t("amountDue")}</span>
                      <span style={{ fontWeight: 700, color: "#ea580c" }}>{parseFloat(sale.amountDue).toFixed(2)} {sale.currency}</span>
                    </div>
                  )}
                </div>
              </div>

              {sale.notes && (
                <div className="notes-box" style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "14px 18px", marginBottom: "24px" }}>
                  <div className="notes-title" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#92400e", fontWeight: 700, marginBottom: "6px" }}>{t("notes")}</div>
                  <p style={{ fontSize: "13px", color: "#78350f", margin: 0 }}>{sale.notes}</p>
                </div>
              )}
            </div>

            <div className="invoice-footer" style={{ textAlign: "center", padding: "20px 35px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <p className="footer-thank" style={{ fontSize: "16px", fontWeight: 800, color: "#1e3a5f", marginBottom: "4px" }}>{t("thankYou")}</p>
              <p className="footer-company" style={{ fontSize: "12px", color: "#64748b", letterSpacing: "1px", margin: 0 }}>MD CARS - Car Accessories & Parts</p>
              <div className="footer-line" style={{ width: "60px", height: "3px", background: "linear-gradient(90deg, #2563eb, #60a5fa)", margin: "10px auto 0", borderRadius: "2px" }} />
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
