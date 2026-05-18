#!/usr/bin/env node
// Run this once on the production server: node fix-partners.js
// It fixes partner ownership percentages based on net capital

import pg from "pg";
import { readFileSync } from "fs";

const envFile = new URL(".env", import.meta.url);
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  try {
    const env = readFileSync(envFile, "utf8");
    const match = env.match(/DATABASE_URL=(.+)/);
    if (match) dbUrl = match[1].trim();
  } catch (_) {}
}

if (!dbUrl) {
  console.error("ERROR: DATABASE_URL not found. Set it or add it to .env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

console.log("Connected to database. Fixing partner ownership percentages...\n");

// Step 1: Recompute totals from actual transactions
await client.query(`
  UPDATE partners p
  SET
    total_invested    = COALESCE((SELECT SUM(CAST(amount AS decimal)) FROM partner_transactions WHERE partner_id = p.id AND type = 'investment'), 0),
    total_withdrawn   = COALESCE((SELECT SUM(CAST(amount AS decimal)) FROM partner_transactions WHERE partner_id = p.id AND type = 'withdrawal'), 0),
    total_profit_distributed = COALESCE((SELECT SUM(CAST(amount AS decimal)) FROM partner_transactions WHERE partner_id = p.id AND type = 'profit_distribution'), 0)
`);
console.log("Step 1: Totals recomputed from transactions.");

// Step 2: Recalculate ownership % based on net capital (invested - withdrawn - profit_distributed)
await client.query(`
  UPDATE partners p
  SET ownership_percentage = (
    CASE
      WHEN (
        SELECT SUM(GREATEST(
          CAST(total_invested AS decimal) - CAST(total_withdrawn AS decimal) - CAST(total_profit_distributed AS decimal),
          0
        )) FROM partners
      ) > 0
      THEN ROUND(
        GREATEST(
          CAST(p.total_invested AS decimal) - CAST(p.total_withdrawn AS decimal) - CAST(p.total_profit_distributed AS decimal),
          0
        ) /
        (SELECT SUM(GREATEST(
          CAST(total_invested AS decimal) - CAST(total_withdrawn AS decimal) - CAST(total_profit_distributed AS decimal),
          0
        )) FROM partners) * 100,
        2
      )
      ELSE 0
    END
  )
`);
console.log("Step 2: Ownership percentages recalculated.\n");

// Step 3: Show result
const { rows } = await client.query(
  "SELECT name, total_invested, total_withdrawn, total_profit_distributed, ownership_percentage FROM partners ORDER BY created_at"
);

console.log("Results:");
for (const r of rows) {
  const net = parseFloat(r.total_invested) - parseFloat(r.total_withdrawn) - parseFloat(r.total_profit_distributed);
  console.log(`  ${r.name}: invested=${r.total_invested}, withdrawn=${r.total_withdrawn}, net=${net.toFixed(2)}, ownership=${r.ownership_percentage}%`);
}

await client.end();
console.log("\nDone! Refresh the Partners page in your browser.");
