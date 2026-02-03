import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, Users, ShoppingCart, Wallet, BarChart3, Settings, LogOut, Menu, Boxes, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/components/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";

const navigationItems = [
  { key: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["owner", "cashier", "stock_manager"] },
  { key: "POS / Sales", href: "/pos", icon: ShoppingCart, roles: ["owner", "cashier"] },
  { key: "Products", href: "/products", icon: Package, roles: ["owner", "cashier", "stock_manager"] },
  { key: "Inventory", href: "/inventory", icon: Boxes, roles: ["owner", "stock_manager"] },
  { key: "Customers", href: "/customers", icon: Users, roles: ["owner", "cashier"] },
  { key: "Finance", href: "/finance", icon: Wallet, roles: ["owner"] },
  { key: "Reports", href: "/reports", icon: BarChart3, roles: ["owner"] },
  { key: "Settings", href: "/settings", icon: Settings, roles: ["owner"] },
];

interface SidebarContentProps {
  onNavigate?: () => void;
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: lowStockData } = useQuery<Array<any>>({
    queryKey: ["/api/products/low-stock"],
    enabled: !!user && (user.role === "owner" || user.role === "stock_manager"),
  });

  const lowStockCount = lowStockData?.length || 0;

  const handleLogout = async () => {
    try {
      await logout();
      onNavigate?.();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const filteredNavigation = navigationItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const handleNavClick = () => {
    onNavigate?.();
  };

  return (
    <>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">MD CARS</h1>
            <p className="text-xs text-muted-foreground">Car Accessories</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <li key={item.key}>
                <Link href={item.href} onClick={handleNavClick}>
                  <span
                    className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                    data-testid={`nav-${item.key.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '')}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className={`flex-1 ${isActive ? "font-medium" : ""}`}>{item.key}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {lowStockCount > 0 && (user?.role === "owner" || user?.role === "stock_manager") && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{lowStockCount} Low Stock Items</span>
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-primary-foreground">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate capitalize">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  if (!isMobile) {
    return (
      <aside className="w-64 bg-card border-r border-border flex flex-col min-h-screen">
        <SidebarContent />
      </aside>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="fixed top-4 left-4 z-50 bg-card border border-border md:hidden"
          data-testid="button-hamburger-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 flex flex-col">
        <SidebarContent onNavigate={() => setIsOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
