import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      role: "owner" | "cashier" | "stock_manager";
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      isActive: boolean;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!roles.includes(req.user!.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner"])(req, res, next);
}

export function requireCashier(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner", "cashier"])(req, res, next);
}

export function requireStockManager(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner", "stock_manager"])(req, res, next);
}

export function requireSalesAccess(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner", "cashier"])(req, res, next);
}

export function requireInventoryAccess(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner", "stock_manager"])(req, res, next);
}

export function requireFinanceAccess(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner"])(req, res, next);
}
