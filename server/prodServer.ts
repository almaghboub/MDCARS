import express, { type Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { pool } from "./db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log("Running database migrations...");

    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS purchase_type text`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS currency text`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS supplier_name text`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS invoice_number text`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS cost_per_unit decimal(10, 2)`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_type text`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id varchar`);

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

    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS original_total decimal(15, 2)`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS edit_note text`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS edited_at timestamp`);

    console.log("Database migrations completed successfully.");
  } catch (err) {
    console.error("Migration error (non-fatal):", err);
  } finally {
    client.release();
  }
}

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

function serveStatic(app: express.Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  await runMigrations();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  serveStatic(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
