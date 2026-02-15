import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { useIsMobile } from "@/hooks/use-mobile";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import POS from "@/pages/pos";
import Inventory from "@/pages/inventory";
import Customers from "@/pages/customers";
import Finance from "@/pages/finance";
import Reports from "@/pages/reports";
import Invoices from "@/pages/invoices";
import Returns from "@/pages/returns";
import Settings from "@/pages/settings";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      {!isMobile && <Sidebar />}
      {isMobile && <Sidebar />}
      <div className="flex-1 flex flex-col overflow-x-hidden">
        <TopHeader />
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function RoleProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      {!isMobile && <Sidebar />}
      {isMobile && <Sidebar />}
      <div className="flex-1 flex flex-col overflow-x-hidden">
        <TopHeader />
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>

      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/pos">
        <RoleProtectedRoute allowedRoles={["owner", "cashier"]}>
          <POS />
        </RoleProtectedRoute>
      </Route>

      <Route path="/products">
        <ProtectedRoute>
          <Products />
        </ProtectedRoute>
      </Route>

      <Route path="/inventory">
        <RoleProtectedRoute allowedRoles={["owner", "stock_manager"]}>
          <Inventory />
        </RoleProtectedRoute>
      </Route>

      <Route path="/customers">
        <RoleProtectedRoute allowedRoles={["owner", "cashier"]}>
          <Customers />
        </RoleProtectedRoute>
      </Route>

      <Route path="/finance">
        <RoleProtectedRoute allowedRoles={["owner"]}>
          <Finance />
        </RoleProtectedRoute>
      </Route>

      <Route path="/invoices">
        <RoleProtectedRoute allowedRoles={["owner", "cashier"]}>
          <Invoices />
        </RoleProtectedRoute>
      </Route>

      <Route path="/returns">
        <RoleProtectedRoute allowedRoles={["owner", "cashier"]}>
          <Returns />
        </RoleProtectedRoute>
      </Route>

      <Route path="/reports">
        <RoleProtectedRoute allowedRoles={["owner"]}>
          <Reports />
        </RoleProtectedRoute>
      </Route>

      <Route path="/settings">
        <RoleProtectedRoute allowedRoles={["owner"]}>
          <Settings />
        </RoleProtectedRoute>
      </Route>

      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
