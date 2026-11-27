import { NextResponse } from "next/server";
import { getPool, isDatabaseConfigured, withDatabaseRetry } from "../_db";

export const runtime = "nodejs";

type ReviewPayload = {
  bookingCode?: unknown;
  rating?: unknown;
  content?: unknown;
};

type AppointmentRow = {
  id: string;
  customer_name: string;
  service_type: string;
  status: string;
  has_review: boolean;
};

type ReviewRow = {
  id: string;
  rating: number;
  content: string;
  author_name: string;
  service_type: string;
  created_at: Date | string;
};

// 与数据库约束 reviews_content_chk 保持一致
const REVIEW_CONTENT_MAX = 500;

/** 归一化预约单号：去空格与分隔符，统一大写（BP000123） */
function normalizeBookingCode(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[\s-]/g, "").toUpperCase().slice(0, 24);
}

/** 评分必须是 1-5 的整数；非法值统一折算为 0 以便下面做必填校验 */
function normalizeRating(value: unknown) {
  const rating = typeof value === "number" ? value : Number(value);

  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 0;
}

function normalizeContent(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, REVIEW_CONTENT_MAX);
}

/**
 * 姓名脱敏后再公开。
 *
 * 评价卡会展示在获客页，而 appointments.customer_name 是真实姓名，
 * 直接展示等于把客户信息挂在公网上，因此只保留姓氏，其余替换为 *。
 */
function maskCustomerName(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    return "匿名客户";
  }

  const chars = Array.from(trimmed);

  return chars.length <= 1
    ? `${chars[0]}**`
    : `${chars[0]}${"*".repeat(Math.min(chars.length - 1, 2))}`;
}

function toClientReview(row: ReviewRow) {
  return {
    id: row.id,
    content: row.content,
    authorName: row.author_name,
    serviceType: row.service_type,
    rating: row.rating,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  };
}

/** 获客页「客户评价」区拉取最新评价（新→旧） */
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { message: "评价服务暂未配置数据库连接。" },
      { status: 503 },
    );
  }

  try {
    const result = await withDatabaseRetry(() =>
      getPool().query<ReviewRow>(
        `select id, rating, content, author_name, service_type, created_at
           from public.reviews
          order by created_at desc
          limit 30`,
      ),
    );

    return NextResponse.json({ reviews: result.rows.map(toClientReview) });
  } catch (error) {
    console.error("Failed to list reviews", error);

    return NextResponse.json(
      { message: "评价加载失败，请稍后再试。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: ReviewPayload;

  try {
    body = (await request.json()) as ReviewPayload;
  } catch {
    return NextResponse.json({ message: "评价信息格式不正确。" }, { status: 400 });
  }

  const bookingCode = normalizeBookingCode(body.bookingCode);
  const rating = normalizeRating(body.rating);
  const content = normalizeContent(body.content);

  if (!bookingCode) {
    return NextResponse.json({ message: "请填写预约单号。" }, { status: 400 });
  }

  if (!rating) {
    return NextResponse.json(
      { message: "请为本次服务打 1-5 分。" },
      { status: 400 },
    );
  }

  if (!content) {
    return NextResponse.json({ message: "请写下你的评价内容。" }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    console.error(
      "SUPABASE_POSTGRES_SESSION_POOL_URL 未配置，评价无法写入数据库。请在 .env.local 中补充该变量后重启服务。",
    );

    return NextResponse.json(
      { message: "评价服务暂未配置数据库连接，请致电 400-882-1024 反馈。" },
      { status: 503 },
    );
  }

  try {
    const appointmentResult = await withDatabaseRetry(() =>
      getPool().query<AppointmentRow>(
        `select a.id, a.customer_name, a.service_type, a.status,
                exists (
                  select 1 from public.reviews r where r.appointment_id = a.id
                ) as has_review
           from public.appointments a
          where a.booking_code = $1`,
        [bookingCode],
      ),
    );

    const appointment = appointmentResult.rows[0];

    if (!appointment) {
      return NextResponse.json(
        { message: "未找到该预约单号，请核对后再试。" },
        { status: 404 },
      );
    }

    if (appointment.status === "cancelled" || appointment.status === "no_show") {
      return NextResponse.json(
        { message: "该预约已取消或未到店，暂不支持评价。" },
        { status: 400 },
      );
    }

    if (appointment.has_review) {
      return NextResponse.json(
        { message: "该预约单号已经评价过啦，感谢你的反馈。" },
        { status: 409 },
      );
    }

    const insertResult = await withDatabaseRetry(() =>
      getPool().query<ReviewRow>(
        `insert into public.reviews
          (appointment_id, rating, content, author_name, service_type)
         values
          ($1, $2, $3, $4, $5)
         returning id, rating, content, author_name, service_type, created_at`,
        [
          appointment.id,
          rating,
          content,
          maskCustomerName(appointment.customer_name),
          appointment.service_type,
        ],
      ),
    );

    const review = insertResult.rows[0];

    console.info(
      `New review created: id=${review?.id} appointment=${appointment.id} rating=${rating}`,
    );

    return NextResponse.json({ review: toClientReview(review) }, { status: 201 });
  } catch (error) {
    const pgError = error as { code?: string };

    // 23505：命中 reviews_appointment_uidx（并发提交或重复评价）
    if (pgError.code === "23505") {
      return NextResponse.json(
        { message: "该预约单号已经评价过啦，感谢你的反馈。" },
        { status: 409 },
      );
    }

    // 23514：违反 CHECK 约束
    if (pgError.code === "23514") {
      return NextResponse.json(
        { message: "评价内容不符合要求，请检查后重试。" },
        { status: 400 },
      );
    }

    console.error("Failed to create review", error);

    return NextResponse.json(
      { message: "评价提交失败，请稍后再试。" },
      { status: 500 },
    );
  }
}