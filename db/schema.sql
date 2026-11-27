-- ============================================================
-- 泡泡爪 Pet Spa —— 业务表 DDL（与 Supabase 迁移保持一致）
--
-- 归属迁移：create_appointments_table
--           add_booking_code_and_reviews
-- 写入方式：仅允许后端通过 PostgreSQL Session Pooler 写入，
--           前端不持有任何数据库凭证。
--
-- 该文件是表结构的版本化快照；如需重建，可直接在 Supabase
-- SQL Editor 中整段执行，或本地运行 node db/apply-schema.mjs
-- （全部语句均为幂等写法，可重复执行）。
-- ============================================================

create table if not exists public.appointments (
  id             uuid        primary key default gen_random_uuid(),
  customer_name  text        not null,
  phone          text        not null,
  arrival_time   timestamptz not null,
  pet_type       text        not null,
  service_type   text        not null,
  note           text,
  status         text        not null default 'pending',
  source         text        not null default 'website',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  public.appointments               is '到店洗护预约业务表（官网表单经后端写入）';
comment on column public.appointments.customer_name is '联系人姓名，1-80 字符';
comment on column public.appointments.phone         is '手机号，仅数字，中国大陆 11 位';
comment on column public.appointments.arrival_time  is '期望到店时间；UTC 存储，业务时区 Asia/Shanghai';
comment on column public.appointments.pet_type      is '宠物类型：小型犬/中大型犬/长毛猫/短毛猫';
comment on column public.appointments.service_type  is '服务项目：基础洗护/精致造型/皮毛护理/幼宠适应';
comment on column public.appointments.note          is '客户备注，最长 500 字符';
comment on column public.appointments.status        is '预约状态：pending/confirmed/arrived/completed/cancelled/no_show';
comment on column public.appointments.source        is '线索来源渠道，官网固定为 website';
comment on column public.appointments.created_at    is '创建时间，由数据库生成';
comment on column public.appointments.updated_at    is '最后更新时间，由触发器自动维护';

-- ---------------- 数据完整性约束 ----------------
-- add constraint 本身不幂等（重复执行报 duplicate_object），
-- 因此逐条判断 pg_constraint 后再执行，保证整份文件可重跑。
do $$
declare
  item record;
begin
  for item in
    select *
      from (values
        ('appointments_customer_name_chk', 'check (char_length(btrim(customer_name)) between 1 and 80)'),
        ('appointments_phone_chk',         'check (phone ~ ''^1[3-9][0-9]{9}$'')'),
        ('appointments_pet_type_chk',      'check (pet_type in (''小型犬'', ''中大型犬'', ''长毛猫'', ''短毛猫''))'),
        ('appointments_service_type_chk',  'check (service_type in (''基础洗护'', ''精致造型'', ''皮毛护理'', ''幼宠适应''))'),
        ('appointments_status_chk',        'check (status in (''pending'', ''confirmed'', ''arrived'', ''completed'', ''cancelled'', ''no_show''))'),
        ('appointments_note_chk',          'check (note is null or char_length(note) <= 500)')
      ) as t(name, definition)
  loop
    if not exists (
      select 1
        from pg_constraint
       where conrelid = 'public.appointments'::regclass
         and conname = item.name
    ) then
      execute format(
        'alter table public.appointments add constraint %I %s',
        item.name,
        item.definition
      );
    end if;
  end loop;
end
$$;

-- ---------------- 索引 ----------------
-- 门店后台「按提交时间倒序看最新预约」
create index if not exists appointments_created_at_idx
  on public.appointments (created_at desc);

-- 「按手机号查客户历史预约」
create index if not exists appointments_phone_idx
  on public.appointments (phone);

-- 「按状态 + 到店时间查档期」，如待确认预约
create index if not exists appointments_status_arrival_idx
  on public.appointments (status, arrival_time);

-- 业务去重：同一手机号在同一到店时间只能存在一条“生效中”的预约，
-- 已取消 / 已爽约的记录不占用名额，允许客户重新预约。
create unique index if not exists appointments_active_slot_uidx
  on public.appointments (phone, arrival_time)
  where status in ('pending', 'confirmed', 'arrived');

-- ---------------- updated_at 自动维护 ----------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists appointments_set_updated_at on public.appointments;

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------- 行级安全 ----------------
-- 开启 RLS 且不创建任何 policy：
--   anon / authenticated 角色无法通过 PostgREST 直接读写该表（防止手机号等个人信息泄露）；
--   后端通过 Session Pooler 以 postgres 角色写入，该角色具有 BYPASSRLS，不受影响。
alter table public.appointments enable row level security;

-- ---------------- 业务规则备忘（暂未用数据库约束实现） ----------------
-- 门店营业时间 09:30 - 20:30（Asia/Shanghai）。
-- 未加入 CHECK 约束的原因：跨时区表达式会降低可读性且难以维护，
-- 该规则由后端接口在写入前校验，避免周末/节假日等特殊排期被硬约束卡死。

-- ============================================================
-- 增量迁移：add_booking_code_and_reviews
--
-- 业务动线：提交预约 -> 拿到 BP 开头的单号 -> 凭单号在获客页写评价
--           -> 评价出现在「客户评价」区。
-- 全部语句幂等，可重复执行。
-- ============================================================

-- ---------------- 预约单号 ----------------
create sequence if not exists public.appointments_code_seq;

alter table public.appointments
  add column if not exists booking_code text;

-- 默认值由序列生成：BP + 6 位序号（BP000001）。
-- 不给客户端 uuid 而给短序号：客户可能口头报出或从短信里复制。
alter table public.appointments
  alter column booking_code
  set default ('BP' || lpad(nextval('public.appointments_code_seq')::text, 6, '0'));

-- 回填历史数据：列刚加上时旧行为 null
update public.appointments
   set booking_code = 'BP' || lpad(nextval('public.appointments_code_seq')::text, 6, '0')
 where booking_code is null;

alter table public.appointments
  alter column booking_code set not null;

create unique index if not exists appointments_booking_code_uidx
  on public.appointments (booking_code);

comment on column public.appointments.booking_code is '面向客户的预约单号，BP + 6 位序号，评价时用于定位预约记录';

-- ---------------- 客户评价 ----------------
create table if not exists public.reviews (
  id             uuid        primary key default gen_random_uuid(),
  appointment_id uuid        not null references public.appointments (id) on delete cascade,
  rating         smallint    not null,
  content        text        not null,
  author_name    text        not null,
  service_type   text        not null,
  created_at     timestamptz not null default now()
);

comment on table  public.reviews                is '客户评价表：一条预约最多一条评价，展示在获客页「客户评价」区';
comment on column public.reviews.appointment_id is '关联预约；on delete cascade 跟随预约删除';
comment on column public.reviews.rating         is '评分 1-5，整数';
comment on column public.reviews.content        is '评价正文，1-500 字符';
comment on column public.reviews.author_name    is '展示用署名，写入前已脱敏（张**），不落真实全名';
comment on column public.reviews.service_type   is '本次服务项目，取自关联预约，避免客户端伪造';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.reviews'::regclass and conname = 'reviews_rating_chk'
  ) then
    alter table public.reviews
      add constraint reviews_rating_chk check (rating between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.reviews'::regclass and conname = 'reviews_content_chk'
  ) then
    alter table public.reviews
      add constraint reviews_content_chk
      check (char_length(btrim(content)) between 1 and 500);
  end if;
end
$$;

-- 一条预约只允许评价一次：接口层按单号查重，这里是并发下的最终防线
create unique index if not exists reviews_appointment_uidx
  on public.reviews (appointment_id);

-- 获客页「最新评价优先」
create index if not exists reviews_created_at_idx
  on public.reviews (created_at desc);

-- 与 appointments 一致：开启 RLS 且不建 policy，
-- anon / authenticated 无法经 PostgREST 直接读取（评价内容 + 署名同样属于客户产出的公开位）；
-- 后端以 postgres 角色（BYPASSRLS）经 Session Pooler 读写，不受影响。
alter table public.reviews enable row level security;
