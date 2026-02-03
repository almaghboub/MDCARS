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
- **Inventory**: Stock levels, low stock alerts, stock in/out/adjustment tracking, movement history
- **Customers**: Customer database with purchase history, balance tracking, payment recording
- **Finance**: Cashbox management (LYD/USD), expenses by category, revenues tracking
- **Reports**: Sales analytics, best-sellers, daily/monthly summaries, CSV export
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
- **stockMovements**: Stock in/out/adjustment history
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
- Partial payment support with customer balance tracking
- Discount application

### Customer Management
- Purchase history tracking
- Balance owed tracking
- Payment recording to reduce balance
- Contact information and notes

### Financial Management
- Cashbox balance in dual currencies
- Expense categorization (rent, utilities, salaries, supplies, maintenance, marketing, other)
- Revenue source tracking
- Automatic cashbox updates on sales/expenses/revenues

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
