import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, Users, ShoppingCart, Wallet, BarChart3, Settings, LogOut, Menu, Boxes, AlertTriangle, FileText, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/components/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n } from "@/lib/i18n";
import logoPath from "@assets/MD-removebg-preview_1770139105370.png";

const navigationItems = [
  { labelKey: "dashboard" as const, href: "/dashboard", icon: LayoutDashboard, roles: ["owner", "cashier", "stock_manager"] },
  { labelKey: "posSales" as const, href: "/pos", icon: ShoppingCart, roles: ["owner", "cashier"] },
  { labelKey: "products" as const, href: "/products", icon: Package, roles: ["owner", "cashier", "stock_manager"] },
  { labelKey: "inventory" as const, href: "/inventory", icon: Boxes, roles: ["owner", "stock_manager"] },
  { labelKey: "customers" as const, href: "/customers", icon: Users, roles: ["owner", "cashier"] },
  { labelKey: "invoices" as const, href: "/invoices", icon: FileText, roles: ["owner", "cashier"] },
  { labelKey: "partners" as const, href: "/partners", icon: Handshake, roles: ["owner"] },
  { labelKey: "finance" as const, href: "/finance", icon: Wallet, roles: ["owner"] },
  { labelKey: "reports" as const, href: "/reports", icon: BarChart3, roles: ["owner"] },
  { labelKey: "settings" as const, href: "/settings", icon: Settings, roles: ["owner"] },
];

interface SidebarContentProps {
  onNavigate?: () => void;
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useI18n();

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
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-center">
          <img src={logoPath} alt="MD Cars Logo" className="h-16 w-auto" />
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <li key={item.labelKey}>
                <Link href={item.href} onClick={handleNavClick}>
                  <span
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                    data-testid={`nav-${item.labelKey}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className={`flex-1 ${isActive ? "font-medium" : ""}`}>{t(item.labelKey)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {lowStockCount > 0 && (user?.role === "owner" || user?.role === "stock_manager") && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-md">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{lowStockCount} {t("lowStockItems")}</span>
            </div>
          </div>
        )}

      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-slate-400 truncate capitalize">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
            data-testid="button-logout"
            title={t("logout")}
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
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col min-h-screen text-white">
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
      <SheetContent side="left" className="w-64 p-0 flex flex-col bg-slate-950 text-white border-slate-800">
        <SidebarContent onNavigate={() => setIsOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
