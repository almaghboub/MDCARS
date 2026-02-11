import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["owner", "cashier", "stock_manager"]);
export const currencyEnum = pgEnum("currency", ["USD", "LYD"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "partial"]);
export const saleStatusEnum = pgEnum("sale_status", ["completed", "pending", "cancelled", "returned"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", ["in", "out", "adjustment"]);
export const expenseCategoryEnum = pgEnum("expense_category", ["rent", "utilities", "salaries", "supplies", "maintenance", "marketing", "other"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["sale", "expense", "deposit", "withdrawal", "adjustment", "refund"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("cashier"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode"),
  categoryId: varchar("category_id").references(() => categories.id),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  currentStock: integer("current_stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  type: stockMovementTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }),
  reason: text("reason"),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  balanceOwed: decimal("balance_owed", { precision: 10, scale: 2 }).notNull().default("0"),
  totalPurchases: decimal("total_purchases", { precision: 10, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleNumber: text("sale_number").notNull().unique(),
  customerId: varchar("customer_id").references(() => customers.id),
  status: saleStatusEnum("status").notNull().default("completed"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  amountDue: decimal("amount_due", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("cash"),
  currency: currencyEnum("currency").notNull().default("LYD"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }),
  notes: text("notes"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const saleItems = pgTable("sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  productSku: text("product_sku").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  profit: decimal("profit", { precision: 10, scale: 2 }).notNull(),
});

export const cashbox = pgTable("cashbox", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().default("Main Cashbox"),
  balanceUSD: decimal("balance_usd", { precision: 15, scale: 2 }).notNull().default("0"),
  balanceLYD: decimal("balance_lyd", { precision: 15, scale: 2 }).notNull().default("0"),
  lastReconciliationDate: timestamp("last_reconciliation_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cashboxTransactions = pgTable("cashbox_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cashboxId: varchar("cashbox_id").notNull().references(() => cashbox.id),
  type: transactionTypeEnum("type").notNull(),
  amountUSD: decimal("amount_usd", { precision: 15, scale: 2 }).notNull().default("0"),
  amountLYD: decimal("amount_lyd", { precision: 15, scale: 2 }).notNull().default("0"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }),
  description: text("description"),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseNumber: text("expense_number").notNull().unique(),
  category: expenseCategoryEnum("category").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull().default("LYD"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }),
  description: text("description").notNull(),
  personName: text("person_name"),
  date: timestamp("date").notNull().defaultNow(),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const revenues = pgTable("revenues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  revenueNumber: text("revenue_number").notNull().unique(),
  source: text("source").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull().default("LYD"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }),
  description: text("description"),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  date: timestamp("date").notNull().defaultNow(),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  type: text("type").notNull().default("string"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
export const insertSaleItemSchema = createInsertSchema(saleItems).omit({ id: true });
export const insertCashboxSchema = createInsertSchema(cashbox).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCashboxTransactionSchema = createInsertSchema(cashboxTransactions).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertRevenueSchema = createInsertSchema(revenues).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type InsertCashbox = z.infer<typeof insertCashboxSchema>;
export type InsertCashboxTransaction = z.infer<typeof insertCashboxTransactionSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertRevenue = z.infer<typeof insertRevenueSchema>;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Cashbox = typeof cashbox.$inferSelect;
export type CashboxTransaction = typeof cashboxTransactions.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Revenue = typeof revenues.$inferSelect;
export type Setting = typeof settings.$inferSelect;

export type ProductWithCategory = Product & { category: Category | null };
export type SaleWithDetails = Sale & {
  customer: Customer | null;
  items: SaleItem[];
  createdBy: User;
};
export type CustomerWithSales = Customer & { sales: Sale[] };

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginCredentials = z.infer<typeof loginSchema>;
