/**
 * 应用 db/schema.sql 到业务库（Supabase Postgres）。
 *
 *   node db/apply-schema.mjs
 *
 * 设计说明：
 *   1. schema.sql 内所有语句都写成幂等形式，本脚本可以反复执行；
 *   2. 整份文件通过 simple query 协议一次下发，PostgreSQL 会把它包在
 *      同一个隐式事务里，任何一条失败则整体回滚，不会留下半套表结构；
 *   3. 连接串从 .env.local 读取，不写死任何凭证。
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const dbDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dbDir, "..");

/** 极简 .env 解析：只处理 KEY=VALUE、# 注释和成对引号，避免为脚本额外引入依赖 */
async function loadEnvFile(filePath) {
  let text;

  try {
    text = await readFile(filePath, "utf8");
  } catch {
    return;
  }

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    process.env[key] ??= value;
  }
}

function stripUnsupportedParams(connectionString) {
  const url = new URL(connectionString);

  // 与 app/api/_db.ts 保持一致：SSL 由 Pool 的 ssl 选项控制
  url.searchParams.delete("sslmode");
  url.searchParams.delete("uselibpqcompat");

  return url.toString();
}

await loadEnvFile(path.join(projectRoot, ".env.local"));
await loadEnvFile(path.join(projectRoot, ".env"));

const connectionString = process.env.SUPABASE_POSTGRES_SESSION_POOL_URL;

if (!connectionString) {
  console.error(
    "未找到 SUPABASE_POSTGRES_SESSION_POOL_URL。请在 .env.local 中补充该变量后重试。",
  );
  process.exit(1);
}

const schemaPath = path.join(dbDir, "schema.sql");
const sql = await readFile(schemaPath, "utf8");

const pool = new Pool({
  connectionString: stripUnsupportedParams(connectionString),
  connectionTimeoutMillis: 15_000,
  max: 1,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log(`Applying ${path.relative(projectRoot, schemaPath)} ...`);
  await pool.query(sql);

  const { rows } = await pool.query(`
    select
      (select count(*) from information_schema.columns
        where table_schema = 'public'
          and table_name = 'appointments'
          and column_name = 'booking_code')            as booking_code_column,
      (select count(*) from information_schema.tables
        where table_schema = 'public'
          and table_name = 'reviews')                  as reviews_table,
      (select count(*) from public.appointments)       as appointment_rows,
      (select count(*) from public.reviews)            as review_rows
  `);

  const summary = rows[0];

  console.log("schema.sql applied successfully.");
  console.log(
    `  booking_code column : ${Number(summary.booking_code_column) === 1 ? "ok" : "missing"}`,
  );
  console.log(
    `  reviews table       : ${Number(summary.reviews_table) === 1 ? "ok" : "missing"}`,
  );
  console.log(`  appointments rows   : ${summary.appointment_rows}`);
  console.log(`  reviews rows        : ${summary.review_rows}`);
} catch (error) {
  console.error("Failed to apply schema.sql");
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}