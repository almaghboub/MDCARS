# Overview

MD CARS is a comprehensive Car Accessories Sales & Inventory Management System built with React, Express, and PostgreSQL. It provides retail business management with product catalog, real-time inventory tracking, POS sales interface, customer management, and financial tracking with dual currency support (LYD/USD).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is a React 18 TypeScript SPA using Wouter for routing, TanStack Query for server state, and Tailwind CSS with shadcn/ui for styling. React Hook Form with Zod handles forms, and Vite is used for building.

### Pages
- **Dashboard**: Key metrics, today's sales/revenue, low stock alerts, cashbox balance, best sellers
- **POS (Point of Sale)**: Cart-based sales interface with product search, customer selection, dual currency, partial payments
- **Products**: Product catalog with categories, CRUD operations, SKU/barcode support
- **Inventory**: Stock levels, low stock alerts, stock in/out/adjustment tracking, movement history, stock-in financial integration (cash/credit purchases with cashbox deduction)
- **Customers**: Customer database with purchase history, balance tracking, payment recording
- **Invoices**: Dedicated invoice history page with search, status filter, and full invoice details
- **Partners**: Partner management with ownership percentages, investment/withdrawal tracking, profit distribution
- **Finance**: Cashbox management (LYD/USD), expenses by category, revenues tracking, sales income tab with invoice viewing
- **Reports**: Sales analytics, best-sellers, daily/monthly summaries, CSV export, invoice viewing, sale returns
- **Settings**: User management with role-based access control

## Backend Architecture

The backend is an Express.js TypeScript REST API. It uses Passport.js for session-based authentication and role-based access control. PostgreSQL with Drizzle ORM handles data persistence.

### API Endpoints
- `/api/auth/*` - Authentication (login, logout, me)
- `/api/users/*` - User management (owner only)
- `/api/categories/*` - Product categories
- `/api/products/*` - Product CRUD, low-stock, stock updates
- `/api/stock-movements` - Stock movement history
- `/api/customers/*` - Customer CRUD, payments
- `/api/sales/*` - Sales transactions
- `/api/cashbox/*` - Cashbox balance and transactions
- `/api/expenses/*` - Expense tracking
- `/api/revenues/*` - Revenue tracking
- `/api/dashboard/stats` - Dashboard statistics
- `/api/reports/*` - Best sellers, daily/monthly reports

## Data Storage Solutions

PostgreSQL with Drizzle ORM. Schema includes:
- **users**: Staff with roles (owner, cashier, stock_manager)
- **categories**: Product categories
- **products**: Product catalog with SKU, barcode, cost/selling prices, stock levels
- **stockMovements**: Stock in/out/adjustment history with purchase type, currency, supplier info
- **supplierPayables**: Supplier credit tracking for stock purchases on credit
- **customers**: Customer database with balance tracking
- **sales**: Sales transactions with items
- **saleItems**: Individual sale line items with profit tracking
- **cashbox**: Dual currency cashbox (LYD/USD)
- **cashboxTransactions**: Cashbox transaction history
- **expenses**: Categorized expenses
- **revenues**: Revenue entries
- **settings**: System settings

## Authentication and Authorization

- Session-based authentication with Passport.js
- Password hashing with bcrypt
- Role-based access control:
  - **owner**: Full access to all features
  - **cashier**: Sales operations (POS, customers, products view)
  - **stock_manager**: Inventory operations (products, stock management)

## Key Features

### Service Fee System
- Separate `serviceFee` field on every sale invoice
- Formula: Final Total = Products Total (subtotal − discount) + Service Fee
- Service fee is shown as its own line in POS cart, checkout dialog, on-screen receipt, and printed invoice
- Service fee is **excluded** from product revenue and profit calculations in all reports
- Stored in `sales.service_fee` column; reports subtract it from `totalAmount` to get product revenue
- Reports show a separate "Total Service Fees" card (visible only when > 0)

### Global Price Markup System
- Adjustable markup percentage applied dynamically to all selling prices
- Base prices stored unchanged in database; markup calculated on display
- Formula: Final Price = Base Price × (1 + Markup % / 100)
- Optional USD exchange rate for USD-based pricing
- Configured in Settings > Pricing tab (owner only)
- Settings stored in `settings` table: `markup_percentage`, `usd_exchange_rate`
- Hook: `client/src/hooks/use-markup.ts`

### Dual Currency Support (LYD/USD)
- Cashbox tracks both LYD and USD balances
- Sales can be made in either currency
- Expenses and revenues tracked by currency
- Dashboard shows both currency totals

### Inventory Management
- Real-time stock tracking
- Low stock threshold alerts
- Stock in/out/adjustment operations
- Complete movement history with reasons

### POS Interface
- Quick product search by name/SKU/barcode
- Shopping cart with quantity management
- Customer selection or walk-in sales
- Split payments: select one or more payment methods per invoice
  - Cash / Credit Card / Money Transfer / Credit Sale (any combination)
  - Each selected method has its own amount input
  - Validation: total of all amounts must equal invoice total
  - Real-time allocation summary showing remaining amount to allocate
  - Change displayed if cash overpayment
- Credit Sale portion: added to customer balance, requires customer selection
- `paymentMethod` on sales record: single method if one used, "mixed" if multiple non-credit, "credit" if credit included
- `sale_payments` table stores each split entry (method + amount) per invoice
- Invoice display, print, and reports all show full payment breakdown
- Discount and service fee application

### Customer Management
- Purchase history tracking
- Balance owed tracking with direct edit (set initial balance or override balance in add/edit form)
- Payment recording to reduce balance
- Contact information and notes

### Financial Management
- Cashbox balance in dual currencies
- Expense categorization (rent, utilities, salaries, supplies, maintenance, marketing, other)
- Revenue source tracking
- Automatic cashbox updates on sales/expenses/revenues
- **Cashbox Transactions**: Full edit and delete support
  - Delete: reverses cashbox balance; also deletes linked expense/revenue
  - Edit: updates amount (with cashbox balance adjustment) and description; syncs to linked expense/revenue
  - Deleting an expense/revenue from its tab also reverses the cashbox balance (bug fix)
- **Partners - Auto Ownership %**: Ownership percentage is auto-calculated based on total invested capital
  - Formula: (partner.totalInvested / all partners' totalInvested) × 100
  - Recalculated after every investment transaction
  - Optional initial investment amount when creating a new partner (recorded as first investment + cashbox deposit)
  - Edit partner: shows current auto-calculated ownership % as read-only info

### Reporting
- Daily and monthly sales summaries
- Best-selling products analysis
- CSV export functionality
- Profit tracking per sale

# Default Credentials

- Username: admin
- Password: admin123

# External Dependencies

## Third-Party Services
- **Neon Database**: Serverless PostgreSQL hosting

## Key Libraries
- **Frontend**: React, TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, React Hook Form, Zod
- **Backend**: Express.js, Passport.js, Drizzle ORM
- **UI Components**: Radix UI primitives via shadcn/ui
- **Utilities**: date-fns, class-variance-authority, clsx
