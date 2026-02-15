import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import MemoryStore from "memorystore";
import { z } from "zod";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./auth";
import { requireAuth, requireOwner, requireSalesAccess, requireInventoryAccess, requireFinanceAccess } from "./middleware";
import {
  insertUserSchema,
  insertCategorySchema,
  insertProductSchema,
  insertCustomerSchema,
  insertSaleSchema,
  insertSaleItemSchema,
  insertExpenseSchema,
  insertRevenueSchema,
  insertCashboxTransactionSchema,
  insertPartnerSchema,
  insertPartnerTransactionSchema,
  insertSettingSchema,
} from "@shared/schema";

const SessionStore = MemoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
  app.set('trust proxy', true);
  app.use(session({
    secret: process.env.SESSION_SECRET || "md-cars-secret-key-2024",
    resave: true,
    saveUninitialized: false,
    store: new SessionStore({ checkPeriod: 86400000 }),
    cookie: { 
      secure: process.env.COOKIE_SECURE === 'true',
      httpOnly: true, 
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 
    },
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) return done(null, false, { message: "Invalid credentials" });
      if (!user.isActive) return done(null, false, { message: "Account is disabled" });
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) return done(null, false, { message: "Invalid credentials" });
      return done(null, user);
    } catch (err) { return done(err); }
  }));

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (err) { done(err); }
  });

  await storage.initializeDefaultData();

  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    const user = req.user as any;
    res.json({ user: { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email } });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const user = req.user as any;
    res.json({ user: { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email } });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await storage.getUser((req.user as any).id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) return res.status(400).json({ message: "Current password is incorrect" });
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });
      res.json({ message: "Password changed successfully" });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { username, firstName, lastName, email, phone } = req.body;
      const updateData: any = {};
      if (username) updateData.username = username;
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      const user = await storage.updateUser(userId, updateData);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ user: { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email } });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/users", requireOwner, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users.map(u => ({ ...u, password: undefined })));
  });

  app.post("/api/users", requireOwner, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({ ...data, password: hashedPassword });
      res.json({ ...user, password: undefined });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/users/:id", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      if (data.password) data.password = await hashPassword(data.password);
      const user = await storage.updateUser(id, data);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ ...user, password: undefined });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/users/:id", requireOwner, async (req, res) => {
    const deleted = await storage.deleteUser(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  });

  app.get("/api/categories", requireAuth, async (req, res) => {
    res.json(await storage.getAllCategories());
  });

  app.post("/api/categories", requireOwner, async (req, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      res.json(await storage.createCategory(data));
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/categories/:id", requireOwner, async (req, res) => {
    const category = await storage.updateCategory(req.params.id, req.body);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  });

  app.delete("/api/categories/:id", requireOwner, async (req, res) => {
    const deleted = await storage.deleteCategory(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Category not found" });
    res.json({ message: "Category deleted" });
  });

  app.get("/api/products", requireAuth, async (req, res) => {
    res.json(await storage.getAllProducts());
  });

  app.get("/api/products/search", requireAuth, async (req, res) => {
    const query = req.query.q as string || "";
    res.json(await storage.searchProducts(query));
  });

  app.get("/api/products/low-stock", requireAuth, async (req, res) => {
    res.json(await storage.getLowStockProducts());
  });

  app.get("/api/products/:id", requireAuth, async (req, res) => {
    const product = await storage.getProduct(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.post("/api/products", requireInventoryAccess, async (req, res) => {
    try {
      const allProducts = await storage.getAllProducts();
      const maxSku = allProducts.reduce((max, p) => {
        const num = parseInt(p.sku, 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      const nextSku = String(maxSku + 1);
      const { purchaseType, stockCurrency, supplierName, invoiceNumber, ...productFields } = req.body;
      const data = insertProductSchema.parse({ ...productFields, sku: nextSku });
      const product = await storage.createProduct(data);

      const initialStock = data.currentStock || 0;
      const costPrice = parseFloat(data.costPrice || "0");
      if (initialStock > 0 && costPrice > 0 && !isNaN(costPrice)) {
        const effectivePurchaseType = purchaseType && ["cash", "credit"].includes(purchaseType) ? purchaseType : "cash";
        const effectiveCurrency = stockCurrency && ["LYD", "USD"].includes(stockCurrency) ? stockCurrency : "LYD";
        const totalCost = (costPrice * initialStock).toFixed(2);

        const movement = await storage.createStockMovement({
          productId: product.id,
          type: "in",
          quantity: initialStock,
          previousStock: 0,
          newStock: initialStock,
          costPerUnit: String(costPrice),
          reason: "Initial stock",
          purchaseType: effectivePurchaseType,
          currency: effectiveCurrency,
          supplierName: supplierName || null,
          invoiceNumber: invoiceNumber || null,
          createdByUserId: (req.user as any).id,
        });

        if (effectivePurchaseType === "credit") {
          await storage.createSupplierPayable({
            supplierName: supplierName || "Unknown Supplier",
            amount: totalCost,
            currency: effectiveCurrency,
            description: `Initial stock: ${product.name} x${initialStock} @ ${costPrice} ${effectiveCurrency}${invoiceNumber ? ` (Inv# ${invoiceNumber})` : ""}`,
            stockMovementId: movement.id,
            createdByUserId: (req.user as any).id,
          });
        }
      }

      res.json(product);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/products/:id", requireInventoryAccess, async (req, res) => {
    const product = await storage.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.delete("/api/products/:id", requireOwner, async (req, res) => {
    const deleted = await storage.deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  });

  app.post("/api/products/:id/stock", requireInventoryAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { type, reason, supplierName, invoiceNumber } = req.body;
      const quantity = parseInt(req.body.quantity);
      const costPerUnit = req.body.costPerUnit ? String(req.body.costPerUnit) : null;
      const purchaseType = req.body.purchaseType;
      const currency = req.body.currency;
      if (!type || !["in", "out", "adjustment"].includes(type)) return res.status(400).json({ message: "Invalid stock movement type" });
      if (isNaN(quantity) || quantity <= 0) return res.status(400).json({ message: "Quantity must be a positive number" });
      if (purchaseType && !["cash", "credit"].includes(purchaseType)) return res.status(400).json({ message: "Invalid purchase type" });
      if (currency && !["LYD", "USD"].includes(currency)) return res.status(400).json({ message: "Invalid currency" });
      const product = await storage.getProduct(id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      const previousStock = product.currentStock;
      const newStock = type === "in" ? previousStock + quantity : type === "out" ? previousStock - quantity : quantity;
      if (newStock < 0) return res.status(400).json({ message: "Insufficient stock" });
      await storage.updateProductStock(id, newStock);
      const movement = await storage.createStockMovement({
        productId: id,
        type,
        quantity,
        previousStock,
        newStock,
        costPerUnit,
        reason,
        purchaseType: type === "in" ? (purchaseType || "cash") : null,
        currency: type === "in" ? (currency || "LYD") : null,
        supplierName: type === "in" ? (supplierName || null) : null,
        invoiceNumber: type === "in" ? (invoiceNumber || null) : null,
        createdByUserId: (req.user as any).id,
      });

      if (type === "in" && costPerUnit && quantity > 0) {
        const totalCost = (parseFloat(costPerUnit) * quantity).toFixed(2);
        const effectiveCurrency = currency || "LYD";
        const effectivePurchaseType = purchaseType || "cash";

        if (effectivePurchaseType === "credit") {
          await storage.createSupplierPayable({
            supplierName: supplierName || "Unknown Supplier",
            amount: totalCost,
            currency: effectiveCurrency,
            description: `Stock purchase: ${product.name} x${quantity} @ ${costPerUnit} ${effectiveCurrency}${invoiceNumber ? ` (Inv# ${invoiceNumber})` : ""}`,
            stockMovementId: movement.id,
            createdByUserId: (req.user as any).id,
          });
        }
      }

      res.json(await storage.getProduct(id));
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/stock-movements", requireAuth, async (req, res) => {
    const productId = req.query.productId as string | undefined;
    res.json(await storage.getStockMovements(productId));
  });

  app.get("/api/customers", requireAuth, async (req, res) => {
    res.json(await storage.getAllCustomers());
  });

  app.get("/api/customers/search", requireAuth, async (req, res) => {
    const query = req.query.q as string || "";
    res.json(await storage.searchCustomers(query));
  });

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    const customer = await storage.getCustomerWithSales(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  });

  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const data = insertCustomerSchema.parse(req.body);
      res.json(await storage.createCustomer(data));
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    const customer = await storage.updateCustomer(req.params.id, req.body);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  });

  app.delete("/api/customers/:id", requireOwner, async (req, res) => {
    const deleted = await storage.deleteCustomer(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Customer not found" });
    res.json({ message: "Customer deleted" });
  });

  app.post("/api/customers/:id/payment", requireSalesAccess, async (req, res) => {
    try {
      const paymentSchema = z.object({ amount: z.string(), currency: z.enum(["LYD", "USD"]).default("LYD") });
      const { amount, currency } = paymentSchema.parse(req.body);
      const customer = await storage.updateCustomerBalance(req.params.id, amount, false);
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const cashbox = await storage.getCashbox();
      if (cashbox) {
        const amountUSD = currency === "USD" ? amount : "0";
        const amountLYD = currency === "LYD" ? amount : "0";
        await storage.updateCashboxBalance(amountUSD, amountLYD, true);
        await storage.createCashboxTransaction({
          cashboxId: cashbox.id,
          type: "deposit",
          amountUSD,
          amountLYD,
          exchangeRate: "1",
          description: `Customer payment from ${customer.name}`,
          createdByUserId: (req.user as any).id,
        });
      }

      res.json(customer);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/sales", requireAuth, async (req, res) => {
    res.json(await storage.getAllSales());
  });

  app.get("/api/sales/next-number", requireAuth, async (req, res) => {
    res.json({ saleNumber: await storage.getNextSaleNumber() });
  });

  app.get("/api/sales/:id", requireAuth, async (req, res) => {
    const sale = await storage.getSale(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    res.json(sale);
  });

  app.post("/api/sales", requireSalesAccess, async (req, res) => {
    try {
      const { sale: saleData, items } = req.body;
      const saleNumber = await storage.getNextSaleNumber();
      const validatedSale = insertSaleSchema.parse({ ...saleData, saleNumber, createdByUserId: (req.user as any).id });
      const validatedItems = items.map((item: any) => insertSaleItemSchema.omit({ saleId: true }).parse(item));
      const sale = await storage.createSale(validatedSale, validatedItems);

      const cashbox = await storage.getCashbox();
      if (cashbox) {
        const amountUSD = sale.currency === "USD" ? sale.amountPaid : "0";
        const amountLYD = sale.currency === "LYD" ? sale.amountPaid : "0";
        await storage.updateCashboxBalance(amountUSD, amountLYD, true);
        await storage.createCashboxTransaction({
          cashboxId: cashbox.id,
          type: "sale",
          amountUSD,
          amountLYD,
          exchangeRate: sale.exchangeRate,
          description: `Sale ${sale.saleNumber}`,
          referenceType: "sale",
          referenceId: sale.id,
          createdByUserId: (req.user as any).id,
        });
      }
      res.json(sale);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/sales/:id/status", requireOwner, async (req, res) => {
    const { status } = req.body;
    const sale = await storage.updateSaleStatus(req.params.id, status);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    res.json(sale);
  });

  app.post("/api/sales/:id/return", requireSalesAccess, async (req, res) => {
    try {
      const sale = await storage.returnSale(req.params.id, (req.user as any).id);
      if (!sale) return res.status(400).json({ message: "Sale not found or already returned/cancelled" });
      res.json(sale);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/cashbox", requireAuth, async (req, res) => {
    res.json(await storage.getCashbox());
  });

  app.get("/api/cashbox/transactions", requireFinanceAccess, async (req, res) => {
    res.json(await storage.getCashboxTransactions());
  });

  app.post("/api/cashbox/transactions", requireFinanceAccess, async (req, res) => {
    try {
      const cashbox = await storage.getCashbox();
      if (!cashbox) return res.status(404).json({ message: "Cashbox not found" });
      const data = insertCashboxTransactionSchema.parse({ ...req.body, cashboxId: cashbox.id, createdByUserId: (req.user as any).id });
      const transaction = await storage.createCashboxTransaction(data);
      const isDeposit = data.type === "deposit" || data.type === "sale";
      await storage.updateCashboxBalance(data.amountUSD || "0", data.amountLYD || "0", isDeposit);
      res.json(transaction);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/expenses", requireAuth, async (req, res) => {
    res.json(await storage.getAllExpenses());
  });

  app.get("/api/expenses/next-number", requireAuth, async (req, res) => {
    res.json({ expenseNumber: await storage.getNextExpenseNumber() });
  });

  app.post("/api/expenses", requireFinanceAccess, async (req, res) => {
    try {
      const expenseNumber = await storage.getNextExpenseNumber();
      const data = insertExpenseSchema.parse({ ...req.body, expenseNumber, createdByUserId: (req.user as any).id });
      const expense = await storage.createExpense(data);

      const cashbox = await storage.getCashbox();
      if (cashbox) {
        const amountUSD = expense.currency === "USD" ? expense.amount : "0";
        const amountLYD = expense.currency === "LYD" ? expense.amount : "0";
        await storage.updateCashboxBalance(amountUSD, amountLYD, false);
        await storage.createCashboxTransaction({
          cashboxId: cashbox.id,
          type: "expense",
          amountUSD,
          amountLYD,
          exchangeRate: expense.exchangeRate,
          description: expense.description,
          referenceType: "expense",
          referenceId: expense.id,
          createdByUserId: (req.user as any).id,
        });
      }
      res.json(expense);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/expenses/:id", requireOwner, async (req, res) => {
    const deleted = await storage.deleteExpense(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Expense not found" });
    res.json({ message: "Expense deleted" });
  });

  app.get("/api/revenues", requireAuth, async (req, res) => {
    res.json(await storage.getAllRevenues());
  });

  app.get("/api/revenues/next-number", requireAuth, async (req, res) => {
    res.json({ revenueNumber: await storage.getNextRevenueNumber() });
  });

  app.post("/api/revenues", requireFinanceAccess, async (req, res) => {
    try {
      const revenueNumber = await storage.getNextRevenueNumber();
      const data = insertRevenueSchema.parse({ ...req.body, revenueNumber, createdByUserId: (req.user as any).id });
      const revenue = await storage.createRevenue(data);

      const cashbox = await storage.getCashbox();
      if (cashbox) {
        const amountUSD = revenue.currency === "USD" ? revenue.amount : "0";
        const amountLYD = revenue.currency === "LYD" ? revenue.amount : "0";
        await storage.updateCashboxBalance(amountUSD, amountLYD, true);
        await storage.createCashboxTransaction({
          cashboxId: cashbox.id,
          type: "deposit",
          amountUSD,
          amountLYD,
          exchangeRate: revenue.exchangeRate,
          description: `Revenue: ${revenue.source}`,
          referenceType: "revenue",
          referenceId: revenue.id,
          createdByUserId: (req.user as any).id,
        });
      }
      res.json(revenue);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/revenues/:id", requireOwner, async (req, res) => {
    const deleted = await storage.deleteRevenue(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Revenue not found" });
    res.json({ message: "Revenue deleted" });
  });

  app.get("/api/supplier-payables", requireAuth, async (req, res) => {
    res.json(await storage.getAllSupplierPayables());
  });

  app.post("/api/supplier-payables/:id/pay", requireFinanceAccess, async (req, res) => {
    try {
      const allPayables = await storage.getAllSupplierPayables();
      const existing = allPayables.find(p => p.id === req.params.id);
      if (!existing) return res.status(404).json({ message: "Payable not found" });
      if (existing.isPaid) return res.status(400).json({ message: "This payable has already been paid" });
      const payable = await storage.markSupplierPayablePaid(req.params.id);
      if (!payable) return res.status(404).json({ message: "Payable not found" });

      const box = await storage.getCashbox();
      if (box) {
        const amountUSD = payable.currency === "USD" ? payable.amount : "0";
        const amountLYD = payable.currency === "LYD" ? payable.amount : "0";
        await storage.updateCashboxBalance(amountUSD, amountLYD, false);
        await storage.createCashboxTransaction({
          cashboxId: box.id,
          type: "purchase",
          amountUSD,
          amountLYD,
          description: `Supplier payment: ${payable.supplierName} - ${payable.description}`,
          referenceType: "supplier_payable",
          referenceId: payable.id,
          createdByUserId: (req.user as any).id,
        });
      }
      res.json(payable);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/partners", requireOwner, async (req, res) => {
    res.json(await storage.getAllPartners());
  });

  app.get("/api/partners/:id", requireOwner, async (req, res) => {
    const partner = await storage.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    res.json(partner);
  });

  app.post("/api/partners", requireOwner, async (req, res) => {
    const parsed = insertPartnerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
    res.status(201).json(await storage.createPartner(parsed.data));
  });

  app.patch("/api/partners/:id", requireOwner, async (req, res) => {
    const parsed = insertPartnerSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
    const updated = await storage.updatePartner(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Partner not found" });
    res.json(updated);
  });

  app.delete("/api/partners/:id", requireOwner, async (req, res) => {
    const deleted = await storage.deletePartner(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Partner not found" });
    res.json({ message: "Partner deleted" });
  });

  app.get("/api/partner-transactions", requireOwner, async (req, res) => {
    const partnerId = req.query.partnerId as string | undefined;
    res.json(await storage.getPartnerTransactions(partnerId));
  });

  app.post("/api/partner-transactions", requireOwner, async (req, res) => {
    try {
      const user = req.user as any;
      const parsed = insertPartnerTransactionSchema.safeParse({ ...req.body, createdByUserId: user.id });
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const transaction = await storage.createPartnerTransaction(parsed.data);

      const partner = await storage.getPartner(parsed.data.partnerId);
      const cashbox = await storage.getCashbox();
      if (cashbox && partner) {
        const amountUSD = parsed.data.currency === "USD" ? parsed.data.amount : "0";
        const amountLYD = parsed.data.currency === "LYD" ? parsed.data.amount : "0";

        if (parsed.data.type === "investment") {
          await storage.updateCashboxBalance(amountUSD, amountLYD, true);
          await storage.createCashboxTransaction({
            cashboxId: cashbox.id,
            type: "deposit",
            amountUSD,
            amountLYD,
            exchangeRate: "1",
            description: `Partner investment from ${partner.name}`,
            createdByUserId: user.id,
          });
        } else if (parsed.data.type === "withdrawal" || parsed.data.type === "profit_distribution") {
          await storage.updateCashboxBalance(amountUSD, amountLYD, false);
          await storage.createCashboxTransaction({
            cashboxId: cashbox.id,
            type: "withdrawal",
            amountUSD,
            amountLYD,
            exchangeRate: "1",
            description: parsed.data.type === "withdrawal"
              ? `Partner withdrawal by ${partner.name}`
              : `Profit distribution to ${partner.name}`,
            createdByUserId: user.id,
          });
        }
      }

      res.status(201).json(transaction);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/settings", requireAuth, async (req, res) => {
    res.json(await storage.getAllSettings());
  });

  app.get("/api/settings/:key", requireAuth, async (req, res) => {
    const setting = await storage.getSetting(req.params.key);
    if (!setting) return res.status(404).json({ message: "Setting not found" });
    res.json(setting);
  });

  app.patch("/api/settings/:key", requireOwner, async (req, res) => {
    const { value } = req.body;
    let setting = await storage.getSetting(req.params.key);
    if (!setting) {
      setting = await storage.createSetting({ key: req.params.key, value, type: "string" });
    } else {
      setting = await storage.updateSetting(req.params.key, value);
    }
    res.json(setting);
  });

  app.get("/api/goods-capital", requireAuth, async (req, res) => {
    const products = await storage.getAllProducts();
    const totalCapitalLYD = products.reduce((sum, p) => sum + parseFloat(p.costPrice) * p.currentStock, 0);
    res.json({ totalCapitalLYD: totalCapitalLYD.toFixed(2) });
  });

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    res.json(await storage.getDashboardStats());
  });

  app.get("/api/reports/best-sellers", requireAuth, async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    res.json(await storage.getBestSellingProducts(limit));
  });

  app.get("/api/reports/daily", requireAuth, async (req, res) => {
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    res.json(await storage.getDailySalesReport(date));
  });

  app.get("/api/reports/monthly", requireAuth, async (req, res) => {
    const now = new Date();
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const month = parseInt(req.query.month as string) || now.getMonth() + 1;
    res.json(await storage.getMonthlySalesReport(year, month));
  });

  const httpServer = createServer(app);
  return httpServer;
}
