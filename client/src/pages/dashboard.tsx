import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, Users, AlertTriangle, DollarSign, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

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
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: bestSellers, isLoading: bestSellersLoading } = useQuery<BestSeller[]>({
    queryKey: ["/api/reports/best-sellers"],
  });

  const { data: lowStockProducts } = useQuery<Array<any>>({
    queryKey: ["/api/products/low-stock"],
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
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to MD CARS Management System</p>
        </div>
        <Link href="/pos">
          <Button data-testid="button-new-sale">
            <ShoppingCart className="w-4 h-4 mr-2" />
            New Sale
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Sales</p>
                <p className="text-2xl font-bold" data-testid="text-today-sales">{stats?.todaySales || 0}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Revenue</p>
                <p className="text-2xl font-bold" data-testid="text-today-revenue">{stats?.todayRevenue?.toFixed(2) || "0.00"} LYD</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold" data-testid="text-total-products">{stats?.totalProducts || 0}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold" data-testid="text-total-customers">{stats?.totalCustomers || 0}</p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Cashbox Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-medium">LYD Balance</span>
                <span className="text-xl font-bold" data-testid="text-cashbox-lyd">{stats?.cashboxBalanceLYD?.toFixed(2) || "0.00"} LYD</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-medium">USD Balance</span>
                <span className="text-xl font-bold" data-testid="text-cashbox-usd">${stats?.cashboxBalanceUSD?.toFixed(2) || "0.00"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Low Stock Alert ({stats?.lowStockCount || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts && lowStockProducts.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-auto">
                {lowStockProducts.slice(0, 5).map((product: any) => (
                  <div key={product.id} className="flex justify-between items-center p-2 bg-destructive/10 rounded" data-testid={`low-stock-product-${product.id}`}>
                    <span className="font-medium">{product.name}</span>
                    <span className="text-destructive font-bold">{product.currentStock} left</span>
                  </div>
                ))}
                {lowStockProducts.length > 5 && (
                  <Link href="/inventory">
                    <Button variant="outline" className="w-full mt-2">View All ({lowStockProducts.length})</Button>
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">All products are well stocked</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Best Selling Products
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
                    <p className="font-bold">{item.totalSold} sold</p>
                    <p className="text-sm text-muted-foreground">{item.totalRevenue.toFixed(2)} LYD</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No sales data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
