import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, Users, AlertTriangle, DollarSign, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/lib/i18n";

interface DashboardStats {
  todaySales: number;
  todayRevenue: number;
  totalProducts: number;
  lowStockCount: number;
  totalCustomers: number;
  cashboxBalanceUSD: number;
  cashboxBalanceLYD: number;
}

interface BestSeller {
  productId: string;
  productName: string;
  totalSold: number;
  totalRevenue: number;
}

export default function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const isCashier = user?.role === "cashier";
  const isStockManager = user?.role === "stock_manager";

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: bestSellers, isLoading: bestSellersLoading } = useQuery<BestSeller[]>({
    queryKey: ["/api/reports/best-sellers"],
    enabled: isOwner,
  });

  const { data: lowStockProducts } = useQuery<Array<any>>({
    queryKey: ["/api/products/low-stock"],
    enabled: isOwner || isStockManager,
  });

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">{t("dashboard")}</h1>
          <p className="text-muted-foreground">{t("welcomeSystem")}</p>
        </div>
        {(isOwner || isCashier) && (
          <Link href="/pos">
            <Button data-testid="button-new-sale">
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t("newSale")}
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("todaysSales")}</p>
                <p className="text-2xl font-bold" data-testid="text-today-sales">{stats?.todaySales || 0}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        {isOwner && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("todaysRevenue")}</p>
                  <p className="text-2xl font-bold" data-testid="text-today-revenue">{stats?.todayRevenue?.toFixed(2) || "0.00"} LYD</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("totalProducts")}</p>
                <p className="text-2xl font-bold" data-testid="text-total-products">{stats?.totalProducts || 0}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        {(isOwner || isCashier) && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("totalCustomers")}</p>
                  <p className="text-2xl font-bold" data-testid="text-total-customers">{stats?.totalCustomers || 0}</p>
                </div>
                <Users className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        )}

        {(isOwner || isStockManager) && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("lowStockItems")}</p>
                  <p className="text-2xl font-bold text-destructive" data-testid="text-low-stock-count">{stats?.lowStockCount || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {t("cashboxBalance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium">{t("lydBalance")}</span>
                  <span className="text-xl font-bold" data-testid="text-cashbox-lyd">{stats?.cashboxBalanceLYD?.toFixed(2) || "0.00"} LYD</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium">{t("usdBalance")}</span>
                  <span className="text-xl font-bold" data-testid="text-cashbox-usd">${stats?.cashboxBalanceUSD?.toFixed(2) || "0.00"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {(isOwner || isStockManager) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                {t("lowStockAlert")} ({stats?.lowStockCount || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts && lowStockProducts.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-auto">
                  {lowStockProducts.slice(0, 5).map((product: any) => (
                    <div key={product.id} className="flex justify-between items-center p-2 bg-destructive/10 rounded" data-testid={`low-stock-product-${product.id}`}>
                      <span className="font-medium">{product.name}</span>
                      <span className="text-destructive font-bold">{product.currentStock} {t("left")}</span>
                    </div>
                  ))}
                  {lowStockProducts.length > 5 && (
                    <Link href="/inventory">
                      <Button variant="outline" className="w-full mt-2">{t("viewAll")} ({lowStockProducts.length})</Button>
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">{t("allWellStocked")}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {t("bestSellingProducts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestSellersLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : bestSellers && bestSellers.length > 0 ? (
              <div className="space-y-2">
                {bestSellers.slice(0, 5).map((item, index) => (
                  <div key={item.productId} className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid={`best-seller-${index}`}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">{index + 1}</span>
                      <span className="font-medium">{item.productName}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{item.totalSold} {t("sold")}</p>
                      <p className="text-sm text-muted-foreground">{item.totalRevenue.toFixed(2)} LYD</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">{t("noSalesDataYet")}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
