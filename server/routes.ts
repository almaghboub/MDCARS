import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import MemoryStore from "memorystore";
import { z } from "zod";
import { storage } from "./storage";
import { pool } from "./db";
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

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log("Running database migrations...");

    // stock_movements columns
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS purchase_type text`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS currency text`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS supplier_name text`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS invoice_number text`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS cost_per_unit decimal(10, 2)`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_type text`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id varchar`);

    // Add 'damaged' value to stock_movement_type enum (safe, idempotent)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'damaged' AND enumtypid = 'stock_movement_type'::regtype) THEN
          ALTER TYPE stock_movement_type ADD VALUE 'damaged';
        END IF;
      END $$;
    `);

    // Add 'credit' value to payment_method enum (safe, idempotent)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'credit' AND enumtypid = 'payment_method'::regtype) THEN
          ALTER TYPE payment_method ADD VALUE 'credit';
        END IF;
      END $$;
    `);

    // Add 'card' and 'transfer' values to payment_method enum (safe, idempotent)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'card' AND enumtypid = 'payment_method'::regtype) THEN
          ALTER TYPE payment_method ADD VALUE 'card';
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'transfer' AND enumtypid = 'payment_method'::regtype) THEN
          ALTER TYPE payment_method ADD VALUE 'transfer';
        END IF;
      END $$;
    `);

    // products: damaged_stock column
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS damaged_stock integer NOT NULL DEFAULT 0`);

    // supplier_payables table
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_payables (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        supplier_name text NOT NULL,
        amount decimal(15, 2) NOT NULL,
        currency text NOT NULL DEFAULT 'LYD',
        description text,
        stock_movement_id varchar,
        is_paid boolean NOT NULL DEFAULT false,
        paid_at timestamp,
        created_by_user_id varchar NOT NULL REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    // sales columns
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS original_total decimal(15, 2)`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS edit_note text`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS edited_at timestamp`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS service_fee decimal(10, 2) NOT NULL DEFAULT 0`);

    // Add 'mixed' value to payment_method enum (split payments)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'mixed' AND enumtypid = 'payment_method'::regtype) THEN
          ALTER TYPE payment_method ADD VALUE 'mixed';
        END IF;
      END $$;
    `);

    // sale_payments table for split payment tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_payments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_id varchar NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        method payment_method NOT NULL,
        amount decimal(10, 2) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    // sale_items: item-level payment tracking
    await client.query(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT true`);
    await client.query(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS paid_at timestamp`);
    // Existing credit sale items → mark as unpaid (only if not already set to false)
    await client.query(`
      UPDATE sale_items si
      SET is_paid = false
      FROM sales s
      WHERE si.sale_id = s.id
        AND CAST(s.amount_due AS decimal) > 0
        AND si.is_paid = true
    `);

    // Create orders table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number text NOT NULL,
        customer_id varchar REFERENCES customers(id),
        receiver_name text NOT NULL,
        receiver_phone text NOT NULL,
        shipping_country text NOT NULL DEFAULT 'Libya',
        shipping_city text NOT NULL,
        shipping_category text NOT NULL DEFAULT 'normal',
        shipping_cost decimal(10,2) NOT NULL DEFAULT 0,
        shipping_weight decimal(10,2) NOT NULL DEFAULT 0,
        total_amount decimal(10,2) NOT NULL DEFAULT 0,
        down_payment decimal(10,2) NOT NULL DEFAULT 0,
        down_payment_type text,
        remaining_balance decimal(10,2) NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'pending',
        notes text,
        lyd_exchange_rate decimal(10,4) NOT NULL DEFAULT 1,
        darb_assabil_order_id text,
        darb_assabil_reference text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    // Create order_items table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_name text NOT NULL,
        quantity integer NOT NULL DEFAULT 1,
        price decimal(10,2) NOT NULL DEFAULT 0,
        cost decimal(10,2) NOT NULL DEFAULT 0,
        weight decimal(10,3) NOT NULL DEFAULT 0,
        profit decimal(10,2) NOT NULL DEFAULT 0
      )
    `);

    // Add any missing columns to orders table for backward compatibility
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS down_payment_type text`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS lyd_exchange_rate decimal(10,4) NOT NULL DEFAULT 1`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS darb_assabil_order_id text`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS darb_assabil_reference text`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT NOW()`);

    // Reconcile all partner totals from their actual transactions (fixes stale percentages)
    await client.query(`
      UPDATE partners p
      SET
        total_invested    = COALESCE((SELECT SUM(CAST(amount AS decimal)) FROM partner_transactions WHERE partner_id = p.id AND type = 'investment'), 0),
        total_withdrawn   = COALESCE((SELECT SUM(CAST(amount AS decimal)) FROM partner_transactions WHERE partner_id = p.id AND type = 'withdrawal'), 0),
        total_profit_distributed = COALESCE((SELECT SUM(CAST(amount AS decimal)) FROM partner_transactions WHERE partner_id = p.id AND type = 'profit_distribution'), 0)
    `);

    // Recalculate ownership percentage for all partners based on total_invested
    await client.query(`
      UPDATE partners p
      SET ownership_percentage = (
        CASE
          WHEN (SELECT SUM(CAST(total_invested AS decimal)) FROM partners) > 0
          THEN ROUND(
            CAST(p.total_invested AS decimal) /
            (SELECT SUM(CAST(total_invested AS decimal)) FROM partners) * 100,
            2
          )
          ELSE 0
        END
      )
    `);

    console.log("Database migrations completed successfully.");
  } catch (err) {
    console.error("Migration error (non-fatal):", err);
  } finally {
    client.release();
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await runMigrations();
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
      const data = insertProductSchema.parse({ ...req.body, sku: nextSku });
      const product = await storage.createProduct(data);

      const initialStock = data.currentStock || 0;
      const costPrice = parseFloat(data.costPrice || "0");
      if (initialStock > 0 && costPrice > 0 && !isNaN(costPrice)) {
        await storage.createStockMovement({
          productId: product.id,
          type: "in",
          quantity: initialStock,
          previousStock: 0,
          newStock: initialStock,
          costPerUnit: String(costPrice),
          reason: "Initial stock",
          createdByUserId: (req.user as any).id,
        });
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
      if (!type || !["in", "out", "adjustment", "damaged"].includes(type)) return res.status(400).json({ message: "Invalid stock movement type" });
      if (isNaN(quantity) || quantity <= 0) return res.status(400).json({ message: "Quantity must be a positive number" });
      if (purchaseType && !["cash", "credit"].includes(purchaseType)) return res.status(400).json({ message: "Invalid purchase type" });
      if (currency && !["LYD", "USD"].includes(currency)) return res.status(400).json({ message: "Invalid currency" });
      const product = await storage.getProduct(id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      const previousStock = product.currentStock;
      const previousDamagedStock = product.damagedStock ?? 0;

      let newStock = previousStock;
      let newDamagedStock = previousDamagedStock;

      if (type === "in") {
        newStock = previousStock + quantity;
      } else if (type === "out") {
        newStock = previousStock - quantity;
        if (newStock < 0) return res.status(400).json({ message: "Insufficient stock" });
      } else if (type === "adjustment") {
        newStock = quantity;
      } else if (type === "damaged") {
        if (quantity > previousStock) return res.status(400).json({ message: "Cannot mark more than available stock as damaged" });
        newStock = previousStock - quantity;
        newDamagedStock = previousDamagedStock + quantity;
      }

      await storage.updateProductStock(id, newStock, newDamagedStock);
      const movement = await storage.createStockMovement({
        productId: id,
        type: type as any,
        quantity,
        previousStock,
        newStock,
        costPerUnit,
        reason: type === "damaged" ? (reason || "Damaged item") : reason,
        purchaseType: type === "in" ? (purchaseType || "cash") : null,
        currency: type === "in" ? (currency || "LYD") : null,
        supplierName: type === "in" ? (supplierName || null) : null,
        invoiceNumber: type === "in" ? (invoiceNumber || null) : null,
        createdByUserId: (req.user as any).id,
      });

      if (type === "in" && costPerUnit && quantity > 0) {
        const newCostPerUnit = parseFloat(costPerUnit);
        const totalCost = (newCostPerUnit * quantity).toFixed(2);
        const effectiveCurrency = currency || "LYD";
        const effectivePurchaseType = purchaseType || "cash";

        const oldCostPrice = parseFloat(product.costPrice || "0");
        if (previousStock > 0 && oldCostPrice > 0 && newCostPerUnit !== oldCostPrice) {
          const weightedAvgCost = ((oldCostPrice * previousStock) + (newCostPerUnit * quantity)) / (previousStock + quantity);
          await storage.updateProduct(id, { costPrice: weightedAvgCost.toFixed(2) });
        } else if (previousStock === 0 || oldCostPrice === 0) {
          await storage.updateProduct(id, { costPrice: newCostPerUnit.toFixed(2) });
        }

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

  app.get("/api/customers/:id/invoices", requireAuth, async (req, res) => {
    const salesWithItems = await storage.getSalesByCustomerIdWithItems(req.params.id);
    res.json(salesWithItems);
  });

  app.patch("/api/sale-items/:id/mark-paid", requireSalesAccess, async (req, res) => {
    try {
      const result = await storage.markSaleItemPaid(req.params.id);
      if (!result) return res.status(404).json({ message: "Sale item not found" });
      res.json(result);
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
      const { sale: saleData, items, payments } = req.body;
      const saleNumber = await storage.getNextSaleNumber();
      const validatedSale = insertSaleSchema.parse({ ...saleData, saleNumber, createdByUserId: (req.user as any).id });
      const validatedItems = items.map((item: any) => insertSaleItemSchema.omit({ saleId: true }).parse(item));
      const validatedPayments: { method: string; amount: string }[] = Array.isArray(payments)
        ? payments.map((p: any) => ({ method: String(p.method), amount: String(parseFloat(p.amount) || 0) }))
        : [];
      const sale = await storage.createSale(validatedSale, validatedItems, validatedPayments);

      const cashboxRecord = await storage.getCashbox();
      if (cashboxRecord) {
        if (validatedPayments.length > 0) {
          // Split payment: create one cashbox transaction per non-credit method
          const methodLabel: Record<string, string> = { cash: "Cash", card: "Card", transfer: "Transfer" };
          for (const p of validatedPayments) {
            if (p.method === "credit") continue;
            const amt = parseFloat(p.amount) || 0;
            if (amt <= 0) continue;
            const amountUSD = sale.currency === "USD" ? amt.toFixed(2) : "0";
            const amountLYD = sale.currency === "LYD" ? amt.toFixed(2) : "0";
            await storage.updateCashboxBalance(amountUSD, amountLYD, true);
            await storage.createCashboxTransaction({
              cashboxId: cashboxRecord.id,
              type: "sale",
              amountUSD,
              amountLYD,
              exchangeRate: sale.exchangeRate,
              description: `Sale ${sale.saleNumber} (${methodLabel[p.method] || p.method})`,
              referenceType: "sale",
              referenceId: sale.id,
              createdByUserId: (req.user as any).id,
            });
          }
        } else {
          // Legacy single-payment: deposit full amountPaid
          const amountUSD = sale.currency === "USD" ? sale.amountPaid : "0";
          const amountLYD = sale.currency === "LYD" ? sale.amountPaid : "0";
          await storage.updateCashboxBalance(amountUSD, amountLYD, true);
          await storage.createCashboxTransaction({
            cashboxId: cashboxRecord.id,
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

  app.post("/api/sales/:id/edit", requireSalesAccess, async (req, res) => {
    try {
      const { returnItemIds = [], newItems = [] } = req.body;
      if (!Array.isArray(returnItemIds) || !Array.isArray(newItems)) {
        return res.status(400).json({ message: "Invalid request format" });
      }
      const validatedNewItems = newItems.map((item: any) => ({
        productId: String(item.productId),
        productName: String(item.productName || ""),
        productSku: String(item.productSku || ""),
        quantity: parseInt(String(item.quantity)) || 1,
        unitPrice: String(parseFloat(String(item.unitPrice)) || 0),
        costPrice: String(parseFloat(String(item.costPrice)) || 0),
        totalPrice: String(parseFloat(String(item.totalPrice)) || 0),
        profit: String(parseFloat(String(item.profit)) || 0),
      }));
      const sale = await storage.editSale(req.params.id, returnItemIds, validatedNewItems, (req.user as any).id);
      if (!sale) return res.status(400).json({ message: "Sale not found or cannot be edited" });
      res.json(sale);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
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

  app.patch("/api/cashbox/transactions/:id", requireOwner, async (req, res) => {
    try {
      const tx = await storage.getCashboxTransaction(req.params.id);
      if (!tx) return res.status(404).json({ message: "Transaction not found" });
      const { description, amountUSD, amountLYD } = req.body;
      if (amountUSD !== undefined || amountLYD !== undefined) {
        const oldUSD = parseFloat(tx.amountUSD || "0");
        const oldLYD = parseFloat(tx.amountLYD || "0");
        const newUSD = parseFloat(amountUSD ?? tx.amountUSD ?? "0");
        const newLYD = parseFloat(amountLYD ?? tx.amountLYD ?? "0");
        const diffUSD = newUSD - oldUSD;
        const diffLYD = newLYD - oldLYD;
        const isDeposit = ["deposit", "sale", "revenue"].includes(tx.type);
        if (diffUSD !== 0 || diffLYD !== 0) {
          const primaryDiff = diffUSD !== 0 ? diffUSD : diffLYD;
          const shouldAdd = isDeposit ? primaryDiff > 0 : primaryDiff < 0;
          await storage.updateCashboxBalance(
            Math.abs(diffUSD).toFixed(2),
            Math.abs(diffLYD).toFixed(2),
            shouldAdd
          );
        }
        if (tx.referenceType === "expense" && tx.referenceId) {
          const expAmt = tx.amountLYD !== "0" ? newLYD.toFixed(2) : newUSD.toFixed(2);
          await storage.updateExpense(tx.referenceId, { amount: expAmt, description: description ?? undefined });
        }
        if (tx.referenceType === "revenue" && tx.referenceId) {
          const revAmt = tx.amountLYD !== "0" ? newLYD.toFixed(2) : newUSD.toFixed(2);
          await storage.updateRevenue(tx.referenceId, { amount: revAmt, description: description ?? undefined });
        }
      }
      const updated = await storage.updateCashboxTransaction(req.params.id, {
        description,
        amountUSD: amountUSD?.toString(),
        amountLYD: amountLYD?.toString(),
      });
      res.json(updated);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/cashbox/transactions/:id", requireOwner, async (req, res) => {
    const tx = await storage.getCashboxTransaction(req.params.id);
    if (!tx) return res.status(404).json({ message: "Transaction not found" });
    const isDeposit = ["deposit", "sale", "revenue"].includes(tx.type);
    await storage.updateCashboxBalance(tx.amountUSD || "0", tx.amountLYD || "0", !isDeposit);
    if (tx.referenceType === "expense" && tx.referenceId) {
      await storage.deleteExpense(tx.referenceId);
    }
    if (tx.referenceType === "revenue" && tx.referenceId) {
      await storage.deleteRevenue(tx.referenceId);
    }
    await storage.deleteCashboxTransaction(tx.id);
    res.json({ message: "Transaction deleted" });
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
    const expense = await storage.getExpense(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    const linkedTx = await storage.getCashboxTransactionByReference("expense", expense.id);
    if (linkedTx) {
      await storage.updateCashboxBalance(linkedTx.amountUSD || "0", linkedTx.amountLYD || "0", true);
      await storage.deleteCashboxTransaction(linkedTx.id);
    }
    await storage.deleteExpense(req.params.id);
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
    const revenue = await storage.getRevenue(req.params.id);
    if (!revenue) return res.status(404).json({ message: "Revenue not found" });
    const linkedTx = await storage.getCashboxTransactionByReference("revenue", revenue.id);
    if (linkedTx) {
      await storage.updateCashboxBalance(linkedTx.amountUSD || "0", linkedTx.amountLYD || "0", false);
      await storage.deleteCashboxTransaction(linkedTx.id);
    }
    await storage.deleteRevenue(req.params.id);
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
    try {
      const { initialInvestment, initialInvestmentCurrency, ...partnerData } = req.body;
      const parsed = insertPartnerSchema.omit({ ownershipPercentage: true }).safeParse(partnerData);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const partner = await storage.createPartner({ ...parsed.data, ownershipPercentage: "0" });
      if (initialInvestment && parseFloat(initialInvestment) > 0) {
        await storage.createPartnerTransaction({
          partnerId: partner.id,
          type: "investment",
          amount: parseFloat(initialInvestment).toFixed(2),
          currency: initialInvestmentCurrency || "LYD",
          description: "Initial investment",
          createdByUserId: (req.user as any).id,
        });
        // Investments do NOT affect cashbox — capital is already in the business (products/inventory)
      } else {
        await storage.recalculatePartnerOwnership();
      }
      const updated = await storage.getPartner(partner.id);
      res.status(201).json(updated ?? partner);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
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
      // Investments do NOT affect cashbox — capital is already in the business (products/inventory)
      // Only withdrawals and profit distributions deduct from cashbox (real cash leaving)
      if (cashbox && partner && (parsed.data.type === "withdrawal" || parsed.data.type === "profit_distribution")) {
        const amountUSD = parsed.data.currency === "USD" ? parsed.data.amount : "0";
        const amountLYD = parsed.data.currency === "LYD" ? parsed.data.amount : "0";
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

      res.status(201).json(transaction);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/partner-transactions/:id", requireOwner, async (req, res) => {
    try {
      const { amount, description } = req.body;
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      const existing = await storage.getPartnerTransaction(req.params.id);
      if (!existing) return res.status(404).json({ message: "Transaction not found" });

      const oldAmount = parseFloat(existing.amount);
      const newAmount = parseFloat(amount);
      const delta = newAmount - oldAmount;

      const updated = await storage.updatePartnerTransaction(req.params.id, { amount: newAmount.toFixed(2), description });

      // Investments do NOT affect cashbox — only withdrawals/profit_distributions do
      const cashbox = await storage.getCashbox();
      if (cashbox && delta !== 0 && (existing.type === "withdrawal" || existing.type === "profit_distribution")) {
        const amountUSD = existing.currency === "USD" ? Math.abs(delta).toFixed(2) : "0";
        const amountLYD = existing.currency === "LYD" ? Math.abs(delta).toFixed(2) : "0";
        // If amount increased, deduct more; if decreased, refund the difference
        await storage.updateCashboxBalance(amountUSD, amountLYD, delta < 0);
      }

      res.json(updated);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/partner-transactions/:id", requireOwner, async (req, res) => {
    try {
      const existing = await storage.getPartnerTransaction(req.params.id);
      if (!existing) return res.status(404).json({ message: "Transaction not found" });

      const deleted = await storage.deletePartnerTransaction(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Transaction not found" });

      // Investments never touched cashbox, so no reversal needed when deleting
      // Withdrawals/profit_distributions did deduct cashbox, so refund when deleting
      const cashbox = await storage.getCashbox();
      if (cashbox && (existing.type === "withdrawal" || existing.type === "profit_distribution")) {
        const amountUSD = existing.currency === "USD" ? existing.amount : "0";
        const amountLYD = existing.currency === "LYD" ? existing.amount : "0";
        await storage.updateCashboxBalance(amountUSD, amountLYD, true);
      }

      res.json({ message: "Transaction deleted" });
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
    let totalCostCapital = 0;
    let totalSellingCapital = 0;
    for (const p of products) {
      const cost = parseFloat(p.costPrice || "0");
      const selling = parseFloat(p.sellingPrice || "0");
      const stock = p.currentStock || 0;
      totalCostCapital += cost * stock;
      totalSellingCapital += selling * stock;
    }
    res.json({
      totalCapitalLYD: totalCostCapital.toFixed(2),
      totalCostPrice: totalCostCapital.toFixed(2),
      totalSellingPrice: totalSellingCapital.toFixed(2),
    });
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

  app.get("/api/reports/weekly", requireAuth, async (req, res) => {
    res.json(await storage.getWeeklySalesReport());
  });

  // Orders routes
  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      const allOrders = await storage.getOrders();
      res.json(allOrders);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const order = await storage.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post("/api/orders", requireAuth, async (req, res) => {
    try {
      const { items, ...orderData } = req.body;
      if (!items || items.length === 0) {
        return res.status(400).json({ message: "Order must have at least one item" });
      }
      const order = await storage.createOrder({ ...orderData, items });
      res.status(201).json(order);
    } catch (err: any) {
      console.error("Order creation error:", err);
      res.status(500).json({ message: `Failed to create order: ${err.message}` });
    }
  });

  app.patch("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const { items, ...orderData } = req.body;
      const updated = await storage.updateOrder(req.params.id, { ...orderData, ...(items ? { items } : {}) });
      if (!updated) return res.status(404).json({ message: "Order not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.patch("/api/orders/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await storage.updateOrderStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ message: "Order not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  app.delete("/api/orders/:id", requireOwner, async (req, res) => {
    try {
      const deleted = await storage.deleteOrder(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Order not found" });
      res.json({ message: "Order deleted" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
