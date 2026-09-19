import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";

type BookingPayload = {
  name?: unknown;
  phone?: unknown;
  arrivalTime?: unknown;
  pet?: unknown;
  service?: unknown;
  note?: unknown;
};

declare global {
  var appointmentsPool:
    | {
        connectionString: string;
        pool: Pool;
      }
    | undefined;
}

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

/**
 * 预约库连接池（PostgreSQL Session Pooler）。
 *
 * 前端不持有任何数据库凭证，写入全部经由 Node.js 服务端完成；
 * 连接池挂在 globalThis 上跨请求复用，连接串变化时自动重建，
 * 避免开发热更新与 Serverless 冷启动场景下连接泄漏。
 */
function getPool() {
  const connectionString = getConnectionString();

  if (globalThis.appointmentsPool?.connectionString !== connectionString) {
    void globalThis.appointmentsPool?.pool.end();

    const pool = new Pool({
      connectionString: getPoolConnectionString(connectionString),
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      max: 5,
      ssl: { rejectUnauthorized: false },
    });

    globalThis.appointmentsPool = {
      connectionString,
      pool,
    };

    console.info(
      `Appointments database pool initialized for ${describeConnectionTarget(
        connectionString,
      )}`,
    );
  }

  return globalThis.appointmentsPool.pool;
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

// 中国大陆手机号，与数据库约束 appointments_phone_chk 保持一致
const CHINA_MOBILE_PATTERN = /^1[3-9]\d{9}$/;

// 业务时区固定为 Asia/Shanghai（UTC+8，无夏令时）
const BUSINESS_TIME_ZONE_OFFSET = "+08:00";

// 门店营业时间 09:30 - 20:30
const BUSINESS_OPEN_MINUTES = 9 * 60 + 30;
const BUSINESS_CLOSE_MINUTES = 20 * 60 + 30;

/** 归一化手机号：去除空格与分隔符，并剥离 +86 / 86 国际区号 */
function normalizePhone(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const digits = value.replace(/\D/g, "");

  return digits.length === 13 && digits.startsWith("86")
    ? digits.slice(2)
    : digits;
}

/**
 * 解析到店时间。
 *
 * <input type="datetime-local"> 提交的是不带时区的时间（如 2026-09-20T09:30），
 * 若直接 new Date() 会按「服务器本地时区」解释 —— 部署到 Vercel 等 UTC 环境时
 * 会整体偏移 8 小时，因此这里显式按北京时间解析。
 */
function parseArrivalTime(value: string) {
  const isNaiveLocalDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(
    value,
  );

  return new Date(
    isNaiveLocalDateTime ? `${value}${BUSINESS_TIME_ZONE_OFFSET}` : value,
  );
}

/** 取该时刻在上海时区对应的当日分钟数（0-1439），用于营业时间校验 */
function getShanghaiMinutesOfDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );

  return hour * 60 + minute;
}

export async function POST(request: Request) {
  let body: BookingPayload;

  try {
    body = (await request.json()) as BookingPayload;
  } catch {
    return NextResponse.json({ message: "预约信息格式不正确。" }, { status: 400 });
  }

  const customerName = normalizeText(body.name, 80);
  const phone = normalizePhone(body.phone);
  const petType = normalizeText(body.pet, 40);
  const serviceType = normalizeText(body.service, 40);
  const note = normalizeText(body.note, 500);
  const arrivalTimeValue =
    typeof body.arrivalTime === "string" ? body.arrivalTime.trim() : "";
  const arrivalTime = parseArrivalTime(arrivalTimeValue);

  if (
    !customerName ||
    !phone ||
    !petType ||
    !serviceType ||
    !arrivalTimeValue ||
    Number.isNaN(arrivalTime.getTime())
  ) {
    return NextResponse.json({ message: "请完整填写预约信息。" }, { status: 400 });
  }

  if (!CHINA_MOBILE_PATTERN.test(phone)) {
    return NextResponse.json(
      { message: "请填写正确的 11 位手机号。" },
      { status: 400 },
    );
  }

  if (arrivalTime.getTime() <= Date.now()) {
    return NextResponse.json(
      { message: "到店时间需晚于当前时间，请重新选择。" },
      { status: 400 },
    );
  }

  const arrivalMinutes = getShanghaiMinutesOfDay(arrivalTime);

  if (
    arrivalMinutes < BUSINESS_OPEN_MINUTES ||
    arrivalMinutes > BUSINESS_CLOSE_MINUTES
  ) {
    return NextResponse.json(
      { message: "门店营业时间为 09:30 - 20:30，请选择该时段内的到店时间。" },
      { status: 400 },
    );
  }

  const connectionString = process.env.SUPABASE_POSTGRES_SESSION_POOL_URL;

  if (!connectionString) {
    console.error(
      "SUPABASE_POSTGRES_SESSION_POOL_URL 未配置，预约记录无法写入数据库。请在 .env.local 中补充该变量后重启服务。",
    );

    return NextResponse.json(
      { message: "预约服务暂未配置数据库连接，请致电 400-882-1024 预约。" },
      { status: 503 },
    );
  }

  try {
    const result = await getPool().query<{ id: string; status: string }>(
      `insert into public.appointments
        (customer_name, phone, arrival_time, pet_type, service_type, note, source)
       values
        ($1, $2, $3, $4, $5, $6, 'website')
       returning id, status`,
      [
        customerName,
        phone,
        arrivalTime.toISOString(),
        petType,
        serviceType,
        note || null,
      ],
    );

    const created = result.rows[0];

    console.info(
      `New appointment created: id=${created?.id} status=${created?.status} arrival=${arrivalTime.toISOString()}`,
    );

    return NextResponse.json(
      {
        id: created?.id,
        status: created?.status,
        message: "预约信息已收到。",
      },
      { status: 201 },
    );
  } catch (error) {
    const pgError = error as { code?: string; constraint?: string };

    // 23505：命中 appointments_active_slot_uidx（同一手机号 + 同一时段已有生效中的预约）
    if (pgError.code === "23505") {
      return NextResponse.json(
        { message: "该手机号在此到店时间已有预约，请勿重复提交。" },
        { status: 409 },
      );
    }

    // 23514：违反 CHECK 约束；23502：违反非空约束
    if (pgError.code === "23514" || pgError.code === "23502") {
      return NextResponse.json(
        { message: "预约信息不符合要求，请检查后重试。" },
        { status: 400 },
      );
    }

    console.error("Failed to create appointment", error);

    return NextResponse.json(
      { message: "预约提交失败，请稍后再试。" },
      { status: 500 },
    );
  }
}
