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

export async function POST(request: Request) {
  let body: BookingPayload;

  try {
    body = (await request.json()) as BookingPayload;
  } catch {
    return NextResponse.json({ message: "预约信息格式不正确。" }, { status: 400 });
  }

  const customerName = normalizeText(body.name, 80);
  const phone = normalizeText(body.phone, 30);
  const petType = normalizeText(body.pet, 40);
  const serviceType = normalizeText(body.service, 40);
  const note = normalizeText(body.note, 500);
  const arrivalTimeValue =
    typeof body.arrivalTime === "string" ? body.arrivalTime : "";
  const arrivalTime = new Date(arrivalTimeValue);

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
    const result = await getPool().query<{ id: string }>(
      `insert into public.appointments
        (customer_name, phone, arrival_time, pet_type, service_type, note, source)
       values
        ($1, $2, $3, $4, $5, $6, 'website')
       returning id`,
      [
        customerName,
        phone,
        arrivalTime.toISOString(),
        petType,
        serviceType,
        note || null,
      ],
    );

    return NextResponse.json(
      { id: result.rows[0]?.id, message: "预约信息已收到。" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create appointment", error);
    return NextResponse.json(
      { message: "预约提交失败，请稍后再试。" },
      { status: 500 },
    );
  }
}
