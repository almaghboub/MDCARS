import {
  type User, type InsertUser,
  type Category, type InsertCategory,
  type Product, type InsertProduct, type ProductWithCategory,
  type StockMovement, type InsertStockMovement,
  type Customer, type InsertCustomer, type CustomerWithSales,
  type Sale, type InsertSale, type SaleWithDetails,
  type SaleItem, type InsertSaleItem,
  type Cashbox, type InsertCashbox,
  type CashboxTransaction, type InsertCashboxTransaction,
  type Expense, type InsertExpense,
  type Revenue, type InsertRevenue,
  type Partner, type InsertPartner,
  type PartnerTransaction, type InsertPartnerTransaction,
  type Setting, type InsertSetting,
  users, categories, products, stockMovements, customers,
  sales, saleItems, cashbox, cashboxTransactions, expenses, revenues,
  partners, partnerTransactions, settings,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, or, ilike, and, gte, lte } from "drizzle-orm";
import { hashPassword } from "./auth";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  getAllCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  getAllProducts(): Promise<ProductWithCategory[]>;
  getProduct(id: string): Promise<ProductWithCategory | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  searchProducts(query: string): Promise<ProductWithCategory[]>;
  getLowStockProducts(): Promise<ProductWithCategory[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  updateProductStock(id: string, quantity: number): Promise<Product | undefined>;

  getStockMovements(productId?: string): Promise<StockMovement[]>;
  createStockMovement(movement: InsertStockMovement): Promise<StockMovement>;

  getAllCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  searchCustomers(query: string): Promise<Customer[]>;
  getCustomerWithSales(id: string): Promise<CustomerWithSales | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;
  updateCustomerBalance(id: string, amount: string, add: boolean): Promise<Customer | undefined>;

  getAllSales(): Promise<SaleWithDetails[]>;
  getSale(id: string): Promise<SaleWithDetails | undefined>;
  getSalesByCustomerId(customerId: string): Promise<Sale[]>;
  getSalesByDateRange(startDate: Date, endDate: Date): Promise<SaleWithDetails[]>;
  createSale(sale: InsertSale, items: InsertSaleItem[]): Promise<SaleWithDetails>;
  updateSaleStatus(id: string, status: string): Promise<Sale | undefined>;
  returnSale(id: string, userId: string): Promise<SaleWithDetails | undefined>;
  deleteSale(id: string): Promise<boolean>;
  getNextSaleNumber(): Promise<string>;

  getCashbox(): Promise<Cashbox | undefined>;
  createCashbox(cashbox: InsertCashbox): Promise<Cashbox>;
  updateCashboxBalance(amountUSD: string, amountLYD: string, add: boolean): Promise<Cashbox | undefined>;
  getCashboxTransactions(): Promise<CashboxTransaction[]>;
  createCashboxTransaction(transaction: InsertCashboxTransaction): Promise<CashboxTransaction>;

  getAllExpenses(): Promise<Expense[]>;
  getExpensesByDateRange(startDate: Date, endDate: Date): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: string): Promise<boolean>;
  getNextExpenseNumber(): Promise<string>;

  getAllRevenues(): Promise<Revenue[]>;
  getRevenuesByDateRange(startDate: Date, endDate: Date): Promise<Revenue[]>;
  createRevenue(revenue: InsertRevenue): Promise<Revenue>;
  deleteRevenue(id: string): Promise<boolean>;
  getNextRevenueNumber(): Promise<string>;

  getAllPartners(): Promise<Partner[]>;
  getPartner(id: string): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: string, partner: Partial<InsertPartner>): Promise<Partner | undefined>;
  deletePartner(id: string): Promise<boolean>;
  getPartnerTransactions(partnerId?: string): Promise<PartnerTransaction[]>;
  createPartnerTransaction(transaction: InsertPartnerTransaction): Promise<PartnerTransaction>;

  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string): Promise<Setting | undefined>;

  getDashboardStats(): Promise<{
    todaySales: number;
    todayRevenue: number;
    totalProducts: number;
    lowStockCount: number;
    totalCustomers: number;
    cashboxBalanceUSD: number;
    cashboxBalanceLYD: number;
  }>;

  getBestSellingProducts(limit?: number): Promise<Array<{ productId: string; productName: string; totalSold: number; totalRevenue: number }>>;
  getDailySalesReport(date: Date): Promise<{ totalSales: number; totalRevenue: number; totalProfit: number }>;
  getMonthlySalesReport(year: number, month: number): Promise<{ totalSales: number; totalRevenue: number; totalProfit: number }>;

  initializeDefaultData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getAllCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(categories.name);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  async updateCategory(id: string, categoryData: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db.update(categories).set(categoryData).where(eq(categories.id, id)).returning();
    return category || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllProducts(): Promise<ProductWithCategory[]> {
    const result = await db.select().from(products).leftJoin(categories, eq(products.categoryId, categories.id)).orderBy(products.name);
    return result.map(r => ({ ...r.products, category: r.categories }));
  }

  async getProduct(id: string): Promise<ProductWithCategory | undefined> {
    const [result] = await db.select().from(products).leftJoin(categories, eq(products.categoryId, categories.id)).where(eq(products.id, id));
    if (!result) return undefined;
    return { ...result.products, category: result.categories };
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product || undefined;
  }

  async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.barcode, barcode));
    return product || undefined;
  }

  async searchProducts(query: string): Promise<ProductWithCategory[]> {
    const result = await db.select().from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(or(
        ilike(products.name, `%${query}%`),
        ilike(products.sku, `%${query}%`),
        ilike(products.barcode, `%${query}%`)
      ))
      .orderBy(products.name);
    return result.map(r => ({ ...r.products, category: r.categories }));
  }

  async getLowStockProducts(): Promise<ProductWithCategory[]> {
    const result = await db.select().from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(sql`${products.currentStock} <= ${products.lowStockThreshold}`)
      .orderBy(products.currentStock);
    return result.map(r => ({ ...r.products, category: r.categories }));
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, productData: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products)
      .set({ ...productData, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateProductStock(id: string, quantity: number): Promise<Product | undefined> {
    const [product] = await db.update(products)
      .set({ currentStock: quantity, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product || undefined;
  }

  async getStockMovements(productId?: string): Promise<StockMovement[]> {
    if (productId) {
      return db.select().from(stockMovements).where(eq(stockMovements.productId, productId)).orderBy(desc(stockMovements.createdAt));
    }
    return db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt));
  }

  async createStockMovement(insertMovement: InsertStockMovement): Promise<StockMovement> {
    const [movement] = await db.insert(stockMovements).values(insertMovement).returning();
    return movement;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return db.select().from(customers).orderBy(customers.name);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.phone, phone));
    return customer || undefined;
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    return db.select().from(customers)
      .where(or(
        ilike(customers.name, `%${query}%`),
        ilike(customers.phone, `%${query}%`)
      ))
      .orderBy(customers.name);
  }

  async getCustomerWithSales(id: string): Promise<CustomerWithSales | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    if (!customer) return undefined;
    const customerSales = await db.select().from(sales).where(eq(sales.customerId, id)).orderBy(desc(sales.createdAt));
    return { ...customer, sales: customerSales };
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers)
      .set({ ...customerData, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return customer || undefined;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateCustomerBalance(id: string, amount: string, add: boolean): Promise<Customer | undefined> {
    const customer = await this.getCustomer(id);
    if (!customer) return undefined;
    const currentBalance = parseFloat(customer.balanceOwed);
    const adjustAmount = parseFloat(amount);
    const newBalance = add ? currentBalance + adjustAmount : currentBalance - adjustAmount;
    return this.updateCustomer(id, { balanceOwed: newBalance.toFixed(2) });
  }

  async getAllSales(): Promise<SaleWithDetails[]> {
    const allSales = await db.select().from(sales).orderBy(desc(sales.createdAt));
    const result: SaleWithDetails[] = [];
    for (const sale of allSales) {
      const [customer] = sale.customerId ? await db.select().from(customers).where(eq(customers.id, sale.customerId)) : [null];
      const items = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
      const [createdBy] = await db.select().from(users).where(eq(users.id, sale.createdByUserId));
      result.push({ ...sale, customer, items, createdBy });
    }
    return result;
  }

  async getSale(id: string): Promise<SaleWithDetails | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, id));
    if (!sale) return undefined;
    const [customer] = sale.customerId ? await db.select().from(customers).where(eq(customers.id, sale.customerId)) : [null];
    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
    const [createdBy] = await db.select().from(users).where(eq(users.id, sale.createdByUserId));
    return { ...sale, customer, items, createdBy };
  }

  async getSalesByCustomerId(customerId: string): Promise<Sale[]> {
    return db.select().from(sales).where(eq(sales.customerId, customerId)).orderBy(desc(sales.createdAt));
  }

  async getSalesByDateRange(startDate: Date, endDate: Date): Promise<SaleWithDetails[]> {
    const allSales = await db.select().from(sales)
      .where(and(gte(sales.createdAt, startDate), lte(sales.createdAt, endDate)))
      .orderBy(desc(sales.createdAt));
    const result: SaleWithDetails[] = [];
    for (const sale of allSales) {
      const [customer] = sale.customerId ? await db.select().from(customers).where(eq(customers.id, sale.customerId)) : [null];
      const items = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
      const [createdBy] = await db.select().from(users).where(eq(users.id, sale.createdByUserId));
      result.push({ ...sale, customer, items, createdBy });
    }
    return result;
  }

  async createSale(insertSale: InsertSale, items: InsertSaleItem[]): Promise<SaleWithDetails> {
    const [sale] = await db.insert(sales).values(insertSale).returning();
    const createdItems: SaleItem[] = [];
    for (const item of items) {
      const [saleItem] = await db.insert(saleItems).values({ ...item, saleId: sale.id }).returning();
      createdItems.push(saleItem);
      const [product] = await db.select().from(products).where(eq(products.id, item.productId));
      if (product) {
        const newStock = product.currentStock - item.quantity;
        await db.update(products).set({ currentStock: newStock, updatedAt: new Date() }).where(eq(products.id, item.productId));
        await db.insert(stockMovements).values({
          productId: item.productId,
          type: "out",
          quantity: item.quantity,
          previousStock: product.currentStock,
          newStock,
          reason: "Sale",
          referenceType: "sale",
          referenceId: sale.id,
          createdByUserId: sale.createdByUserId,
        });
      }
    }
    if (sale.customerId) {
      await this.updateCustomerBalance(sale.customerId, sale.amountDue, true);
      const customer = await this.getCustomer(sale.customerId);
      if (customer) {
        const newTotal = parseFloat(customer.totalPurchases) + parseFloat(sale.totalAmount);
        await this.updateCustomer(sale.customerId, { totalPurchases: newTotal.toFixed(2) });
      }
    }
    const [customer] = sale.customerId ? await db.select().from(customers).where(eq(customers.id, sale.customerId)) : [null];
    const [createdBy] = await db.select().from(users).where(eq(users.id, sale.createdByUserId));
    return { ...sale, customer, items: createdItems, createdBy };
  }

  async updateSaleStatus(id: string, status: string): Promise<Sale | undefined> {
    const [sale] = await db.update(sales).set({ status: status as any }).where(eq(sales.id, id)).returning();
    return sale || undefined;
  }

  async returnSale(id: string, userId: string): Promise<SaleWithDetails | undefined> {
    const sale = await this.getSale(id);
    if (!sale) return undefined;
    if (sale.status !== "completed") return undefined;

    await db.update(sales).set({ status: "returned" as any }).where(eq(sales.id, id));

    for (const item of sale.items) {
      const [product] = await db.select().from(products).where(eq(products.id, item.productId));
      if (product) {
        const newStock = product.currentStock + item.quantity;
        await db.update(products).set({ currentStock: newStock, updatedAt: new Date() }).where(eq(products.id, item.productId));
        await db.insert(stockMovements).values({
          productId: item.productId,
          type: "in",
          quantity: item.quantity,
          previousStock: product.currentStock,
          newStock,
          reason: `Return - Sale ${sale.saleNumber}`,
          referenceType: "sale_return",
          referenceId: sale.id,
          createdByUserId: userId,
        });
      }
    }

    const amountUSD = sale.currency === "USD" ? sale.amountPaid : "0";
    const amountLYD = sale.currency === "LYD" ? sale.amountPaid : "0";
    await this.updateCashboxBalance(amountUSD, amountLYD, false);

    const box = await this.getCashbox();
    if (box) {
      await this.createCashboxTransaction({
        cashboxId: box.id,
        type: "refund",
        amountUSD,
        amountLYD,
        exchangeRate: sale.exchangeRate,
        description: `Return - Sale ${sale.saleNumber}`,
        referenceType: "sale_return",
        referenceId: sale.id,
        createdByUserId: userId,
      });
    }

    if (sale.customerId) {
      await this.updateCustomerBalance(sale.customerId, sale.amountDue, false);
      const customer = await this.getCustomer(sale.customerId);
      if (customer) {
        const newTotal = Math.max(0, parseFloat(customer.totalPurchases) - parseFloat(sale.totalAmount));
        await this.updateCustomer(sale.customerId, { totalPurchases: newTotal.toFixed(2) });
      }
    }

    return this.getSale(id);
  }

  async deleteSale(id: string): Promise<boolean> {
    const result = await db.delete(sales).where(eq(sales.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getNextSaleNumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(sales);
    const count = (result?.count || 0) + 1;
    const date = new Date();
    return `MD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(count).padStart(4, '0')}`;
  }

  async getCashbox(): Promise<Cashbox | undefined> {
    const [box] = await db.select().from(cashbox);
    return box || undefined;
  }

  async createCashbox(insertCashbox: InsertCashbox): Promise<Cashbox> {
    const [box] = await db.insert(cashbox).values(insertCashbox).returning();
    return box;
  }

  async updateCashboxBalance(amountUSD: string, amountLYD: string, add: boolean): Promise<Cashbox | undefined> {
    const box = await this.getCashbox();
    if (!box) return undefined;
    const currentUSD = parseFloat(box.balanceUSD);
    const currentLYD = parseFloat(box.balanceLYD);
    const adjustUSD = parseFloat(amountUSD);
    const adjustLYD = parseFloat(amountLYD);
    const newUSD = add ? currentUSD + adjustUSD : currentUSD - adjustUSD;
    const newLYD = add ? currentLYD + adjustLYD : currentLYD - adjustLYD;
    const [updated] = await db.update(cashbox)
      .set({ balanceUSD: newUSD.toFixed(2), balanceLYD: newLYD.toFixed(2), updatedAt: new Date() })
      .where(eq(cashbox.id, box.id))
      .returning();
    return updated || undefined;
  }

  async getCashboxTransactions(): Promise<CashboxTransaction[]> {
    return db.select().from(cashboxTransactions).orderBy(desc(cashboxTransactions.createdAt));
  }

  async createCashboxTransaction(insertTransaction: InsertCashboxTransaction): Promise<CashboxTransaction> {
    const [transaction] = await db.insert(cashboxTransactions).values(insertTransaction).returning();
    return transaction;
  }

  async getAllExpenses(): Promise<Expense[]> {
    return db.select().from(expenses).orderBy(desc(expenses.createdAt));
  }

  async getExpensesByDateRange(startDate: Date, endDate: Date): Promise<Expense[]> {
    return db.select().from(expenses)
      .where(and(gte(expenses.date, startDate), lte(expenses.date, endDate)))
      .orderBy(desc(expenses.date));
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getNextExpenseNumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(expenses);
    const count = (result?.count || 0) + 1;
    return `EXP-${String(count).padStart(5, '0')}`;
  }

  async getAllRevenues(): Promise<Revenue[]> {
    return db.select().from(revenues).orderBy(desc(revenues.createdAt));
  }

  async getRevenuesByDateRange(startDate: Date, endDate: Date): Promise<Revenue[]> {
    return db.select().from(revenues)
      .where(and(gte(revenues.date, startDate), lte(revenues.date, endDate)))
      .orderBy(desc(revenues.date));
  }

  async createRevenue(insertRevenue: InsertRevenue): Promise<Revenue> {
    const [revenue] = await db.insert(revenues).values(insertRevenue).returning();
    return revenue;
  }

  async deleteRevenue(id: string): Promise<boolean> {
    const result = await db.delete(revenues).where(eq(revenues.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getNextRevenueNumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(revenues);
    const count = (result?.count || 0) + 1;
    return `REV-${String(count).padStart(5, '0')}`;
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async getAllSettings(): Promise<Setting[]> {
    return db.select().from(settings).orderBy(settings.key);
  }

  async createSetting(insertSetting: InsertSetting): Promise<Setting> {
    const [setting] = await db.insert(settings).values(insertSetting).returning();
    return setting;
  }

  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    const [setting] = await db.update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, key))
      .returning();
    return setting || undefined;
  }

  async getDashboardStats(): Promise<{
    todaySales: number;
    todayRevenue: number;
    totalProducts: number;
    lowStockCount: number;
    totalCustomers: number;
    cashboxBalanceUSD: number;
    cashboxBalanceLYD: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySalesResult = await db.select({ count: sql<number>`count(*)`, sum: sql<number>`coalesce(sum(${sales.totalAmount}::numeric), 0)` })
      .from(sales)
      .where(and(gte(sales.createdAt, today), lte(sales.createdAt, tomorrow)));
    const [productsResult] = await db.select({ count: sql<number>`count(*)` }).from(products);
    const lowStockResult = await db.select({ count: sql<number>`count(*)` }).from(products)
      .where(sql`${products.currentStock} <= ${products.lowStockThreshold}`);
    const [customersResult] = await db.select({ count: sql<number>`count(*)` }).from(customers);
    const box = await this.getCashbox();

    return {
      todaySales: Number(todaySalesResult[0]?.count || 0),
      todayRevenue: Number(todaySalesResult[0]?.sum || 0),
      totalProducts: Number(productsResult?.count || 0),
      lowStockCount: Number(lowStockResult[0]?.count || 0),
      totalCustomers: Number(customersResult?.count || 0),
      cashboxBalanceUSD: parseFloat(box?.balanceUSD || "0"),
      cashboxBalanceLYD: parseFloat(box?.balanceLYD || "0"),
    };
  }

  async getBestSellingProducts(limit = 10): Promise<Array<{ productId: string; productName: string; totalSold: number; totalRevenue: number }>> {
    const result = await db.select({
      productId: saleItems.productId,
      productName: saleItems.productName,
      totalSold: sql<number>`sum(${saleItems.quantity})`,
      totalRevenue: sql<number>`sum(${saleItems.totalPrice}::numeric)`,
    }).from(saleItems)
      .groupBy(saleItems.productId, saleItems.productName)
      .orderBy(sql`sum(${saleItems.quantity}) desc`)
      .limit(limit);
    return result.map(r => ({
      productId: r.productId,
      productName: r.productName,
      totalSold: Number(r.totalSold),
      totalRevenue: Number(r.totalRevenue),
    }));
  }

  async getDailySalesReport(date: Date): Promise<{ totalSales: number; totalRevenue: number; totalProfit: number }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [result] = await db.select({
      totalSales: sql<number>`count(*)`,
      totalRevenue: sql<number>`coalesce(sum(${sales.totalAmount}::numeric), 0)`,
    }).from(sales).where(and(gte(sales.createdAt, startOfDay), lte(sales.createdAt, endOfDay)));

    const [profitResult] = await db.select({
      totalProfit: sql<number>`coalesce(sum(${saleItems.profit}::numeric), 0)`,
    }).from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(gte(sales.createdAt, startOfDay), lte(sales.createdAt, endOfDay)));

    return {
      totalSales: Number(result?.totalSales || 0),
      totalRevenue: Number(result?.totalRevenue || 0),
      totalProfit: Number(profitResult?.totalProfit || 0),
    };
  }

  async getMonthlySalesReport(year: number, month: number): Promise<{ totalSales: number; totalRevenue: number; totalProfit: number }> {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const [result] = await db.select({
      totalSales: sql<number>`count(*)`,
      totalRevenue: sql<number>`coalesce(sum(${sales.totalAmount}::numeric), 0)`,
    }).from(sales).where(and(gte(sales.createdAt, startOfMonth), lte(sales.createdAt, endOfMonth)));

    const [profitResult] = await db.select({
      totalProfit: sql<number>`coalesce(sum(${saleItems.profit}::numeric), 0)`,
    }).from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(gte(sales.createdAt, startOfMonth), lte(sales.createdAt, endOfMonth)));

    return {
      totalSales: Number(result?.totalSales || 0),
      totalRevenue: Number(result?.totalRevenue || 0),
      totalProfit: Number(profitResult?.totalProfit || 0),
    };
  }

  async getAllPartners(): Promise<Partner[]> {
    return await db.select().from(partners).orderBy(desc(partners.createdAt));
  }

  async getPartner(id: string): Promise<Partner | undefined> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id));
    return partner;
  }

  async createPartner(partner: InsertPartner): Promise<Partner> {
    const [created] = await db.insert(partners).values(partner).returning();
    return created;
  }

  async updatePartner(id: string, partner: Partial<InsertPartner>): Promise<Partner | undefined> {
    const [updated] = await db.update(partners).set(partner).where(eq(partners.id, id)).returning();
    return updated;
  }

  async deletePartner(id: string): Promise<boolean> {
    const existing = await this.getPartner(id);
    if (!existing) return false;
    await db.delete(partnerTransactions).where(eq(partnerTransactions.partnerId, id));
    await db.delete(partners).where(eq(partners.id, id));
    return true;
  }

  async getPartnerTransactions(partnerId?: string): Promise<PartnerTransaction[]> {
    if (partnerId) {
      return await db.select().from(partnerTransactions).where(eq(partnerTransactions.partnerId, partnerId)).orderBy(desc(partnerTransactions.createdAt));
    }
    return await db.select().from(partnerTransactions).orderBy(desc(partnerTransactions.createdAt));
  }

  async createPartnerTransaction(transaction: InsertPartnerTransaction): Promise<PartnerTransaction> {
    const [created] = await db.insert(partnerTransactions).values(transaction).returning();
    const partner = await this.getPartner(transaction.partnerId);
    if (partner) {
      const amount = parseFloat(transaction.amount);
      if (transaction.type === "investment") {
        await db.update(partners).set({
          totalInvested: (parseFloat(partner.totalInvested) + amount).toFixed(2),
        }).where(eq(partners.id, transaction.partnerId));
      } else if (transaction.type === "withdrawal") {
        await db.update(partners).set({
          totalWithdrawn: (parseFloat(partner.totalWithdrawn) + amount).toFixed(2),
        }).where(eq(partners.id, transaction.partnerId));
      } else if (transaction.type === "profit_distribution") {
        await db.update(partners).set({
          totalProfitDistributed: (parseFloat(partner.totalProfitDistributed) + amount).toFixed(2),
        }).where(eq(partners.id, transaction.partnerId));
      }
    }
    return created;
  }

  async initializeDefaultData(): Promise<void> {
    const existingUser = await this.getUserByUsername("admin");
    if (!existingUser) {
      const hashedPassword = await hashPassword("admin123");
      await this.createUser({
        username: "admin",
        password: hashedPassword,
        role: "owner",
        firstName: "Admin",
        lastName: "User",
        email: "admin@mdcars.ly",
      });
    }
    const existingCashbox = await this.getCashbox();
    if (!existingCashbox) {
      await this.createCashbox({ name: "Main Cashbox" });
    }
    const existingSettings = await this.getAllSettings();
    if (existingSettings.length === 0) {
      await this.createSetting({ key: "store_name", value: "MD CARS", type: "string", description: "Store name" });
      await this.createSetting({ key: "exchange_rate", value: "4.85", type: "number", description: "USD to LYD exchange rate" });
      await this.createSetting({ key: "currency_default", value: "LYD", type: "string", description: "Default currency" });
    }
  }
}

export const storage = new DatabaseStorage();
