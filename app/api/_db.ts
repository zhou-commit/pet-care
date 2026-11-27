import { Pool } from "pg";

declare global {
  var petCarePool:
    | {
        signature: string;
        pool: Pool;
      }
    | undefined;
}

/**
 * 连接池调参版本号。
 *
 * pg 的 Pool 选项在构造后无法修改，而 next dev 的热更新不会重置 globalThis。
 * 改动下面 Pool 的选项时把版本号 +1，热更新后首个请求就会重建连接池，
 * 免得为了调一个超时参数反复重启服务。
 */
const POOL_CONFIG_VERSION = 2;

function getConnectionString() {
  const connectionString = process.env.SUPABASE_POSTGRES_SESSION_POOL_URL;

  if (!connectionString) {
    throw new Error("Missing SUPABASE_POSTGRES_SESSION_POOL_URL");
  }

  return connectionString;
}

function describeConnectionTarget(connectionString: string) {
  try {
    const url = new URL(connectionString);

    return `${url.username}@${url.hostname}:${url.port || "5432"}`;
  } catch {
    return "invalid connection string";
  }
}

function getPoolConnectionString(connectionString: string) {
  const url = new URL(connectionString);

  url.searchParams.delete("sslmode");
  url.searchParams.delete("uselibpqcompat");

  return url.toString();
}

/** 是否已配置数据库连接串；未配置时接口应返回可读的降级提示，而不是 500 */
export function isDatabaseConfigured() {
  return Boolean(process.env.SUPABASE_POSTGRES_SESSION_POOL_URL);
}

/**
 * 业务库连接池（PostgreSQL Session Pooler），预约与评价接口共用。
 *
 * 前端不持有任何数据库凭证，读写全部经由 Node.js 服务端完成；
 * 连接池挂在 globalThis 上跨请求复用，避免开发热更新与 Serverless
 * 冷启动场景下连接泄漏。
 *
 * 超时参数是按实测结果定的，不是拍脑袋：
 * 在某些网络下（例如本机到 ap-south-1 孟买节点），TCP 握手正常（200-450ms），
 * 但建 PostgreSQL 会话需要 3-30 秒，已建立连接上的单条查询也会在
 * 217ms ~ 8900ms 之间抖动。因此：
 *   - connectionTimeoutMillis 取 20s，给建连留出跨链路重传的余量；
 *   - idleTimeoutMillis 取 5 分钟，别让连接刚建立就被回收、下次请求再付一次
 *     沉重的握手成本（频繁重建会话会被 pooler 限流，越重连越慢）；
 *   - keepAlive 让底层 TCP 定期探活，避免空闲连接被中间设备静默断开。
 */
export function getPool() {
  const connectionString = getConnectionString();
  const signature = `${POOL_CONFIG_VERSION}|${connectionString}`;

  if (globalThis.petCarePool?.signature !== signature) {
    void globalThis.petCarePool?.pool.end();

    const pool = new Pool({
      connectionString: getPoolConnectionString(connectionString),
      connectionTimeoutMillis: 20_000,
      idleTimeoutMillis: 300_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      max: 5,
      ssl: { rejectUnauthorized: false },
    });

    // 池内空闲连接被对端（Session Pooler、中间网络设备）断开时，pg 会在 pool 上
    // 发出 'error' 事件；没有监听器时 EventEmitter 会抛未捕获异常，直接终止整
    // 个 Node 进程。这里只记录日志，pg 自己会把坏连接从池中剔除并新建。
    pool.on("error", (error) => {
      console.error("Unexpected error on idle PostgreSQL client", error);
    });

    globalThis.petCarePool = {
      signature,
      pool,
    };

    console.info(
      `Database pool initialized for ${describeConnectionTarget(
        connectionString,
      )}`,
    );
  }

  return globalThis.petCarePool.pool;
}

/** 建连阶段的抖动类错误：值得重试，且与「SQL 本身写错」无关 */
const TRANSIENT_DATABASE_ERROR = /timeout expired|Connection terminated|ECONNRESET|ETIMEDOUT|ENOTFOUND/i;

/**
 * 包一层瞬时故障重试。
 *
 * 只对建连/链路类错误重试一次，业务错误（约束冲突、语法错误）原样抛出。
 * 之所以敢对写操作重试：两张业务表都有唯一索引兜底（评价单号唯一、
 * 预约时段唯一），万一首次其实已经写入成功，重试会被唯一约束拦下，
 * 不会产生重复数据。
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  attempts = 2,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const message = error instanceof Error ? error.message : String(error);

      if (!TRANSIENT_DATABASE_ERROR.test(message) || attempt === attempts) {
        throw error;
      }

      console.warn(
        `Database attempt ${attempt}/${attempts} failed (${message}), retrying once.`,
      );
    }
  }

  throw lastError;
}