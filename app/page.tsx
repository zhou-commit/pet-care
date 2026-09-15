"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Bath,
  CalendarCheck,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Droplets,
  HeartHandshake,
  ListChecks,
  MapPin,
  MessageCircle,
  PawPrint,
  Phone,
  PhoneCall,
  Scissors,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

type PriceCategory = "small" | "medium" | "cat";

type PriceItem = {
  name: string;
  description: string;
  amount: string;
};

type ServiceItem = {
  title: string;
  description: string;
  price: string;
  Icon: typeof Bath;
  iconClassName: string;
};

type ProcessItem = {
  step: string;
  title: string;
  description: string;
};

type CarouselSlide = {
  image: string;
  alt: string;
  title: string;
  description: string;
  ariaLabel: string;
};

type ReviewItem = {
  quote: string;
  name: string;
  pet: string;
};

type BookingSubmitState = "idle" | "submitting" | "success" | "error";

const prices: Record<PriceCategory, PriceItem[]> = {
  small: [
    {
      name: "基础洗护",
      description: "适合 8kg 内小型犬，含耳道、指甲、脚底毛护理",
      amount: "¥88",
    },
    {
      name: "洗护加精修",
      description: "含全身造型、面部修剪和尾部细节处理",
      amount: "¥168",
    },
    {
      name: "深层护毛",
      description: "适合掉毛期、毛躁、静电明显的宠物",
      amount: "¥128",
    },
  ],
  medium: [
    {
      name: "基础洗护",
      description: "适合 8-22kg 中型犬，按毛量调整时长",
      amount: "¥138",
    },
    {
      name: "轮廓修剪",
      description: "腹底、臀部、脚边和胸线整理",
      amount: "¥218",
    },
    {
      name: "去浮毛护理",
      description: "洗前梳理、浴后分层吹干和护毛护理",
      amount: "¥188",
    },
  ],
  cat: [
    {
      name: "短毛猫洗护",
      description: "独立猫咪时段，含指甲和耳部基础清洁",
      amount: "¥168",
    },
    {
      name: "长毛猫洗护",
      description: "重点梳开胸腹、腋下和尾部毛发",
      amount: "¥228",
    },
    {
      name: "局部剃毛",
      description: "脚底、腹部或轻度打结区域处理",
      amount: "¥68 起",
    },
  ],
};

const priceTabs: Array<{ label: string; value: PriceCategory }> = [
  { label: "小型宠物", value: "small" },
  { label: "中型宠物", value: "medium" },
  { label: "猫咪护理", value: "cat" },
];

const services: ServiceItem[] = [
  {
    title: "基础洗护",
    description: "清洁耳道、修剪脚底毛、指甲护理、低敏洗浴和分区吹干。",
    price: "¥88 起",
    Icon: Bath,
    iconClassName: "bg-sun text-[#11251f]",
  },
  {
    title: "精致造型",
    description: "按品种和生活习惯设计造型，适合贵宾、比熊、雪纳瑞等犬种。",
    price: "¥168 起",
    Icon: Scissors,
    iconClassName: "bg-coral text-white",
  },
  {
    title: "皮毛护理",
    description: "针对打结、掉毛、干燥和敏感皮肤，搭配护毛素与养护梳理。",
    price: "¥128 起",
    Icon: Droplets,
    iconClassName: "bg-blue text-white",
  },
  {
    title: "幼宠适应",
    description: "缩短流程、降低噪音、正向奖励，帮助幼宠建立温和洗护体验。",
    price: "¥68 起",
    Icon: HeartHandshake,
    iconClassName: "bg-mint text-[#11251f]",
  },
];

const processItems: ProcessItem[] = [
  {
    step: "01",
    title: "到店评估",
    description: "记录毛发、皮肤、耳道和情绪状态，确认是否需要暂停或调整流程。",
  },
  {
    step: "02",
    title: "分区清洁",
    description: "使用低敏清洁产品，面部、耳部、脚掌和身体分开处理。",
  },
  {
    step: "03",
    title: "低噪吹干",
    description: "根据宠物接受度调节风量和温度，长毛宠物分层梳开。",
  },
  {
    step: "04",
    title: "交付反馈",
    description: "提供护理建议和本次状态记录，方便下次复盘宠物变化。",
  },
];

const carouselSlides: CarouselSlide[] = [
  {
    image: "/assets/interior-reception.png",
    alt: "中国高端宠物洗护店的接待与等候区",
    title: "接待与等候区",
    description: "暖木、石材与零售陈列结合，主人可以清楚看到后方透明操作区。",
    ariaLabel: "查看接待与等候区",
  },
  {
    image: "/assets/interior-wash.png",
    alt: "中国高端宠物洗护店的可视化洗护操作区",
    title: "可视化洗护区",
    description: "玻璃隔断、专业洗护台与分区收纳，呈现干净可信赖的护理流程。",
    ariaLabel: "查看可视化洗护区",
  },
  {
    image: "/assets/interior-grooming.png",
    alt: "中国高端宠物洗护店的独立吹干与精修护理区",
    title: "独立吹干精修区",
    description: "低噪护理间、独立工位和柔和照明，适合猫咪与敏感宠物放松洗护。",
    ariaLabel: "查看独立吹干精修区",
  },
];

const reviews: ReviewItem[] = [
  {
    quote: "我家狗很怕吹风，店员会分段休息，洗完也没有以前那种焦虑状态。",
    name: "林女士",
    pet: "柯基主人",
  },
  {
    quote: "猫咪洗护时段很安静，能看到操作区，过程比想象中顺利很多。",
    name: "周先生",
    pet: "布偶猫主人",
  },
  {
    quote: "造型不会剪得夸张，美容师会先问日常活动习惯，细节很专业。",
    name: "赵女士",
    pet: "比熊主人",
  },
  {
    quote: "皮肤敏感的地方会提前标记，洗护后还会提醒回家观察，服务很细。",
    name: "陈先生",
    pet: "柴犬主人",
  },
  {
    quote: "第一次带幼犬洗澡，本来很担心，结果全程都很温柔，还拍了状态照片。",
    name: "吴女士",
    pet: "泰迪主人",
  },
  {
    quote: "长毛猫打结处理得很耐心，没有为了省时间直接大面积剃掉。",
    name: "许女士",
    pet: "缅因猫主人",
  },
  {
    quote: "每次来都会对比上次毛发和耳道情况，像做了一份小小的护理档案。",
    name: "何先生",
    pet: "雪纳瑞主人",
  },
  {
    quote: "店里味道很干净，等待区能看到操作，不会有宠物被带走后看不见的焦虑。",
    name: "唐女士",
    pet: "博美主人",
  },
  {
    quote: "洗完毛发蓬松但不刺鼻，美容师也会讲清楚哪些护理没必要加钱做。",
    name: "马先生",
    pet: "英短主人",
  },
];

function getTomorrowMorningArrivalTime() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 30, 0, 0);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const reviewGroups = Array.from({ length: Math.ceil(reviews.length / 3) }, (_, index) =>
  reviews.slice(index * 3, index * 3 + 3),
);

const iconStroke = 2.1;

function ButtonLink({
  href,
  children,
  variant = "primary",
  ariaLabel,
  title,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "icon";
  ariaLabel?: string;
  title?: string;
}) {
  const variants = {
    primary:
      "min-h-[42px] rounded-lg bg-teal px-[18px] font-bold text-white shadow-[0_10px_26px_rgba(15,123,117,0.22)]",
    secondary:
      "min-h-[42px] rounded-lg border border-line bg-white px-[18px] font-bold text-ink",
    icon: "h-[42px] w-[42px] rounded-lg border border-line bg-white text-ink",
  };

  return (
    <a
      href={href}
      aria-label={ariaLabel}
      title={title}
      className={`inline-flex items-center justify-center gap-2 transition hover:-translate-y-0.5 ${variants[variant]}`}
    >
      {children}
    </a>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-line/80 bg-paper/90 backdrop-blur-[18px]">
      <nav
        className="mx-auto flex min-h-[72px] w-[min(1160px,calc(100%_-_32px))] items-center justify-between gap-6 max-sm:w-[min(100%_-_24px,1160px)]"
        aria-label="主导航"
      >
        <a
          className="inline-flex items-center gap-2.5 text-xl font-extrabold"
          href="#top"
          aria-label="泡泡爪 Pet Spa 首页"
        >
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal text-white shadow-[0_8px_24px_rgba(15,123,117,0.22)]">
            <PawPrint strokeWidth={iconStroke} />
          </span>
          <span className="max-sm:hidden">泡泡爪 Pet Spa</span>
        </a>
        <div className="flex items-center gap-[22px] whitespace-nowrap text-sm text-muted max-[920px]:hidden">
          <a className="hover:text-teal" href="#services">
            洗护项目
          </a>
          <a className="hover:text-teal" href="#process">
            护理流程
          </a>
          <a className="hover:text-teal" href="#pricing">
            价目表
          </a>
          <a className="hover:text-teal" href="#reviews">
            客户评价
          </a>
          <a className="hover:text-teal" href="#contact">
            门店位置
          </a>
        </div>
        <div className="flex items-center gap-2.5">
          <ButtonLink
            href="tel:400-882-1024"
            variant="icon"
            ariaLabel="拨打电话"
            title="拨打电话"
          >
            <Phone strokeWidth={iconStroke} />
          </ButtonLink>
          <ButtonLink href="#booking">
            <CalendarCheck strokeWidth={iconStroke} />
            预约
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}

function BookingForm({
  onSubmit,
  submitState,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitState: BookingSubmitState;
}) {
  const defaultArrivalTime = getTomorrowMorningArrivalTime();
  const isSubmitting = submitState === "submitting";

  return (
    <form
      className="rounded-lg bg-white/95 p-6 text-ink shadow-soft"
      id="booking"
      onSubmit={onSubmit}
    >
      <h2 className="mb-1 text-2xl font-bold">快速预约</h2>
      <p className="mb-[18px] text-sm text-muted">提交后门店会在 10 分钟内确认档期。</p>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <FormField label="联系人" htmlFor="name">
          <input id="name" name="name" placeholder="你的称呼" required />
        </FormField>
        <FormField label="手机号" htmlFor="phone">
          <input id="phone" name="phone" placeholder="138 0000 0000" required />
        </FormField>
        <FormField label="期望到店时间" htmlFor="arrivalTime" full>
          <input
            defaultValue={defaultArrivalTime}
            id="arrivalTime"
            name="arrivalTime"
            type="datetime-local"
            required
          />
        </FormField>
        <FormField label="宠物类型" htmlFor="pet">
          <select id="pet" name="pet">
            <option>小型犬</option>
            <option>中大型犬</option>
            <option>长毛猫</option>
            <option>短毛猫</option>
          </select>
        </FormField>
        <FormField label="服务项目" htmlFor="service">
          <select id="service" name="service">
            <option>基础洗护</option>
            <option>精致造型</option>
            <option>皮毛护理</option>
            <option>幼宠适应</option>
          </select>
        </FormField>
        <FormField label="备注" htmlFor="note" full>
          <textarea
            id="note"
            name="note"
            placeholder="例如：怕吹风、容易紧张、需要剪指甲"
          />
        </FormField>
        <div className="col-span-full">
          <button
            className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-teal px-[18px] font-bold text-white shadow-[0_10px_26px_rgba(15,123,117,0.22)] transition hover:-translate-y-0.5"
            disabled={isSubmitting}
            type="submit"
          >
            <Send strokeWidth={iconStroke} />
            {isSubmitting ? "提交中..." : "发送预约"}
          </button>
        </div>
      </div>
    </form>
  );
}

function FormField({
  children,
  label,
  htmlFor,
  full = false,
}: {
  children: React.ReactNode;
  label: string;
  htmlFor: string;
  full?: boolean;
}) {
  return (
    <div
      className={`grid gap-1.5 [&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-line [&_input]:bg-white [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-ink [&_input]:outline-none [&_input:focus]:border-teal [&_input:focus]:shadow-[0_0_0_3px_rgba(15,123,117,0.12)] [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-line [&_select]:bg-white [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-ink [&_select]:outline-none [&_select:focus]:border-teal [&_select:focus]:shadow-[0_0_0_3px_rgba(15,123,117,0.12)] [&_textarea]:min-h-[78px] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-line [&_textarea]:bg-white [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:text-ink [&_textarea]:outline-none [&_textarea:focus]:border-teal [&_textarea:focus]:shadow-[0_0_0_3px_rgba(15,123,117,0.12)] ${
        full ? "col-span-full" : ""
      }`}
    >
      <label className="text-[13px] font-bold text-[#354052]" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Hero({
  onBookingSubmit,
  submitState,
}: {
  onBookingSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitState: BookingSubmitState;
}) {
  return (
    <section className="relative isolate grid min-h-[calc(100vh-72px)] items-center overflow-hidden bg-[linear-gradient(90deg,rgba(15,25,35,0.72),rgba(15,25,35,0.38)_48%,rgba(15,25,35,0.1)),url('https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=1800&q=82')] bg-cover bg-center after:absolute after:inset-x-0 after:bottom-0 after:-z-10 after:h-24 after:bg-gradient-to-b after:from-transparent after:to-paper max-sm:min-h-0">
      <div className="mx-auto grid w-[min(1160px,calc(100%_-_32px))] grid-cols-[minmax(0,590px)_minmax(320px,420px)] items-end gap-[70px] py-[70px] pb-28 text-white max-[920px]:grid-cols-1 max-sm:w-[min(100%_-_24px,1160px)] max-sm:gap-6 max-sm:py-12 max-sm:pb-[72px]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-mint/90 px-3 py-2 text-sm font-extrabold text-[#16302c]">
            <Sparkles strokeWidth={iconStroke} />
            一宠一浴巾 · 可视化洗护
          </span>
          <h1 className="my-[22px] mb-[18px] max-w-[620px] text-[clamp(42px,7vw,82px)] font-extrabold leading-none tracking-normal">
            泡泡爪 Pet Spa
          </h1>
          <p className="mb-[30px] max-w-[540px] text-lg text-white/85 max-sm:text-base">
            为猫狗提供洗澡、精修、皮毛护理和幼宠适应服务。透明操作区、低噪吹干间和独立消毒工具，让每次洗护都更安心。
          </p>
          <div className="mb-[34px] flex flex-wrap gap-3">
            <ButtonLink href="#booking">
              <CalendarPlus strokeWidth={iconStroke} />
              立即预约
            </ButtonLink>
            <a
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/10 px-[18px] font-bold text-white backdrop-blur-xl transition hover:-translate-y-0.5"
              href="#pricing"
            >
              <ListChecks strokeWidth={iconStroke} />
              查看价目
            </a>
          </div>
          <div
            className="grid max-w-[560px] grid-cols-3 gap-3 max-sm:grid-cols-1"
            aria-label="门店亮点"
          >
            {[
              ["4.9", "本地客户评分"],
              ["45min", "小型犬基础洗护"],
              ["09:30", "每日开始营业"],
            ].map(([value, label]) => (
              <div
                className="rounded-lg border border-white/25 bg-white/10 p-3.5 backdrop-blur-xl"
                key={label}
              >
                <strong className="block text-[22px] leading-tight">{value}</strong>
                <span className="text-[13px] text-white/80">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="max-[920px]:max-w-[560px]">
          <BookingForm onSubmit={onBookingSubmit} submitState={submitState} />
        </div>
      </div>
    </section>
  );
}

function SectionHead({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-6 max-sm:grid max-sm:gap-2.5">
      <h2 className="m-0 text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.15] tracking-normal">
        {title}
      </h2>
      {children ? <p className="m-0 max-w-[430px] text-muted">{children}</p> : null}
    </div>
  );
}

function Services() {
  return (
    <section className="mx-auto w-[min(1160px,calc(100%_-_32px))] py-[76px] max-sm:w-[min(100%_-_24px,1160px)] max-sm:py-[54px]" id="services">
      <SectionHead title="洗护项目">
        从日常清洁到造型护理，按宠物体型、毛量和情绪状态安排独立方案。
      </SectionHead>
      <div className="grid grid-cols-4 gap-4 max-[920px]:grid-cols-2 max-sm:grid-cols-1">
        {services.map(({ title, description, price, Icon, iconClassName }) => (
          <article
            className="flex min-h-[230px] flex-col justify-between rounded-lg border border-line bg-panel p-5 transition hover:-translate-y-1 hover:shadow-soft"
            key={title}
          >
            <div>
              <span
                className={`grid h-12 w-12 place-items-center rounded-lg ${iconClassName}`}
              >
                <Icon strokeWidth={iconStroke} />
              </span>
              <h3 className="mb-2 mt-[18px] text-xl font-bold">{title}</h3>
              <p className="m-0 text-sm text-muted">{description}</p>
            </div>
            <div className="mt-[18px] flex items-center justify-between gap-3 font-extrabold text-teal">
              <span>{price}</span>
              <ArrowRight strokeWidth={iconStroke} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Process() {
  return (
    <section className="mx-auto grid w-[min(1160px,calc(100%_-_32px))] grid-cols-[0.9fr_1.1fr] items-stretch gap-[34px] py-[76px] max-[920px]:grid-cols-1 max-sm:w-[min(100%_-_24px,1160px)] max-sm:py-[54px]" id="process">
      <div className="relative min-h-[520px] overflow-hidden rounded-lg bg-[url('https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1000&q=82')] bg-cover bg-center max-sm:min-h-[330px]">
        <span className="absolute bottom-[18px] left-[18px] flex items-center gap-2.5 rounded-lg bg-ink/70 px-3.5 py-3 font-extrabold text-white backdrop-blur-xl">
          <ShieldCheck strokeWidth={iconStroke} />
          独立消毒工具包
        </span>
      </div>
      <div>
        <SectionHead title="护理流程" />
        <div className="grid gap-3">
          {processItems.map((item) => (
            <div
              className="grid grid-cols-[52px_1fr] gap-3.5 rounded-lg border border-line bg-white p-[18px]"
              key={item.step}
            >
              <span className="grid h-[52px] w-[52px] place-items-center rounded-lg bg-[#edf8f5] text-lg font-black text-teal">
                {item.step}
              </span>
              <div>
                <h3 className="mb-1 text-lg font-bold">{item.title}</h3>
                <p className="m-0 text-muted">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [activeCategory, setActiveCategory] = useState<PriceCategory>("small");

  return (
    <section className="border-y border-[#d9ebe7] bg-[#eef6f4]" id="pricing">
      <div className="mx-auto w-[min(1160px,calc(100%_-_32px))] py-[76px] max-sm:w-[min(100%_-_24px,1160px)] max-sm:py-[54px]">
        <SectionHead title="透明价目">
          价格按体型和毛量浮动，严重打结、攻击性行为或特殊护理会提前沟通。
        </SectionHead>
        <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="价目分类">
          {priceTabs.map((tab) => (
            <button
              className={`min-h-10 rounded-full border px-3.5 font-extrabold ${
                activeCategory === tab.value
                  ? "border-teal bg-teal text-white"
                  : "border-[#cfe4df] bg-white text-muted"
              }`}
              type="button"
              role="tab"
              aria-selected={activeCategory === tab.value}
              key={tab.value}
              onClick={() => setActiveCategory(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          className="overflow-hidden rounded-lg border border-[#cfe4df] bg-white"
          aria-live="polite"
        >
          {prices[activeCategory].map((item) => (
            <div
              className="grid min-h-[68px] grid-cols-[1.2fr_1fr_120px] items-center gap-4 border-b border-[#e3efec] px-[18px] py-4 last:border-b-0 max-sm:grid-cols-1"
              key={item.name}
            >
              <strong className="text-[17px]">{item.name}</strong>
              <span className="text-sm text-muted">{item.description}</span>
              <div className="text-right text-xl font-black text-teal max-sm:text-left">
                {item.amount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EnvironmentCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);

  const showSlide = (index: number) => {
    setActiveSlide((index + carouselSlides.length) % carouselSlides.length);
  };

  return (
    <section className="mx-auto w-[min(1160px,calc(100%_-_32px))] py-[76px] max-sm:w-[min(100%_-_24px,1160px)] max-sm:py-[54px]" id="environment">
      <SectionHead title="店内环境">
        明亮等待区、可视化操作台和独立猫咪洗护时段，让宠物与主人都更放松。
      </SectionHead>
      <div className="relative overflow-hidden rounded-lg bg-[#dfe7ed] shadow-soft" aria-label="店内环境轮播">
        <div
          className="flex transition-transform duration-500 ease-out will-change-transform"
          style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        >
          {carouselSlides.map((slide) => (
            <figure
              className="relative m-0 h-[560px] flex-[0_0_100%] max-[920px]:h-[460px] max-sm:h-[360px]"
              key={slide.title}
            >
              <Image
                className="object-cover"
                src={slide.image}
                alt={slide.alt}
                fill
                sizes="(max-width: 920px) 100vw, 1160px"
              />
              <figcaption className="absolute bottom-[22px] left-[22px] max-w-[min(420px,calc(100%_-_44px))] rounded-lg bg-night/70 px-4 py-3.5 text-white backdrop-blur-xl max-sm:inset-x-3 max-sm:bottom-[54px] max-sm:max-w-none">
                <strong className="mb-1 block text-lg">{slide.title}</strong>
                <span className="block text-sm text-white/80">{slide.description}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <button
          className="absolute left-[18px] top-1/2 z-[2] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg border border-white/50 bg-night/50 text-white backdrop-blur-xl hover:bg-night/70 max-sm:left-3 max-sm:h-[38px] max-sm:w-[38px]"
          type="button"
          aria-label="上一张店内环境"
          onClick={() => showSlide(activeSlide - 1)}
        >
          <ChevronLeft strokeWidth={iconStroke} />
        </button>
        <button
          className="absolute right-[18px] top-1/2 z-[2] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg border border-white/50 bg-night/50 text-white backdrop-blur-xl hover:bg-night/70 max-sm:right-3 max-sm:h-[38px] max-sm:w-[38px]"
          type="button"
          aria-label="下一张店内环境"
          onClick={() => showSlide(activeSlide + 1)}
        >
          <ChevronRight strokeWidth={iconStroke} />
        </button>
        <div
          className="absolute bottom-6 right-[22px] z-[2] flex gap-2 max-sm:bottom-[18px] max-sm:right-3.5"
          aria-label="店内环境图片选择"
        >
          {carouselSlides.map((slide, index) => (
            <button
              className={`h-2.5 rounded-full p-0 transition-all ${
                activeSlide === index ? "w-7 bg-white" : "w-2.5 bg-white/60"
              }`}
              type="button"
              aria-label={slide.ariaLabel}
              key={slide.title}
              onClick={() => showSlide(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  const [activeReviewGroup, setActiveReviewGroup] = useState(0);

  const showReviewGroup = (index: number) => {
    setActiveReviewGroup((index + reviewGroups.length) % reviewGroups.length);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveReviewGroup((current) => (current + 1) % reviewGroups.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="mx-auto w-[min(1160px,calc(100%_-_32px))] py-[76px] max-sm:w-[min(100%_-_24px,1160px)] max-sm:py-[54px]" id="reviews">
      <div className="mb-7 flex items-end justify-between gap-5 max-sm:block">
        <SectionHead title="客户评价">
          每次服务结束都会记录宠物状态，长期客户可以追踪毛发与皮肤变化。
        </SectionHead>
        <div className="flex shrink-0 items-center gap-2 max-sm:mt-4">
          <button
            className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white text-ink transition hover:-translate-y-0.5 hover:border-teal"
            type="button"
            aria-label="上一组客户评价"
            onClick={() => showReviewGroup(activeReviewGroup - 1)}
          >
            <ChevronLeft strokeWidth={iconStroke} />
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white text-ink transition hover:-translate-y-0.5 hover:border-teal"
            type="button"
            aria-label="下一组客户评价"
            onClick={() => showReviewGroup(activeReviewGroup + 1)}
          >
            <ChevronRight strokeWidth={iconStroke} />
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-[#f8fbf8]" aria-live="polite">
        <div
          className="flex transition-transform duration-700 ease-out will-change-transform"
          style={{ transform: `translateX(-${activeReviewGroup * 100}%)` }}
        >
          {reviewGroups.map((group, groupIndex) => (
            <div
              className="grid flex-[0_0_100%] grid-cols-3 gap-4 p-4 max-[920px]:grid-cols-2 max-sm:grid-cols-1 max-sm:p-3"
              key={groupIndex}
            >
              {group.map((review) => (
                <article
                  className="flex min-h-[218px] flex-col rounded-lg border border-line bg-white p-5 shadow-[0_14px_34px_rgba(24,42,38,0.06)]"
                  key={review.name}
                >
                  <div className="mb-3 flex gap-[3px] text-[#e7aa10]" aria-label="五星评价">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} fill="currentColor" strokeWidth={iconStroke} />
                    ))}
                  </div>
                  <p className="mb-5 text-[#354052]">“{review.quote}”</p>
                  <div className="mt-auto border-t border-line pt-4">
                    <strong className="block">{review.name}</strong>
                    <span className="text-[13px] text-muted">{review.pet}</span>
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-2" aria-label="客户评价轮播选择">
        {reviewGroups.map((_, index) => (
          <button
            className={`h-2.5 rounded-full p-0 transition-all ${
              activeReviewGroup === index ? "w-8 bg-teal" : "w-2.5 bg-[#bfd7d1]"
            }`}
            type="button"
            aria-label={`查看第 ${index + 1} 组客户评价`}
            key={index}
            onClick={() => showReviewGroup(index)}
          />
        ))}
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="mx-auto grid w-[min(1160px,calc(100%_-_32px))] gap-[18px] py-[76px] max-sm:w-[min(100%_-_24px,1160px)] max-sm:py-[54px]" id="contact">
      <div className="rounded-lg bg-night p-[26px] text-white">
        <h2 className="mb-5 text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.15] text-white">
          门店信息
        </h2>
        <ul className="m-0 grid list-none grid-cols-4 gap-4 p-0 max-[980px]:grid-cols-2 max-sm:grid-cols-1">
          {[
            {
              Icon: MapPin,
              title: "地址",
              text: "上海市普陀区宜川路街道陕西北路 1620 号",
            },
            { Icon: Clock3, title: "营业时间", text: "周一至周日 09:30 - 20:30" },
            { Icon: PhoneCall, title: "电话", text: "400-882-1024" },
            { Icon: MessageCircle, title: "微信", text: "BubblePawSpa" },
          ].map(({ Icon, title, text }) => (
            <li className="grid grid-cols-[34px_1fr] gap-3 text-white/80" key={title}>
              <Icon strokeWidth={iconStroke} />
              <div>
                <strong className="block text-white">{title}</strong>
                {text}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div
        className="relative min-h-[560px] overflow-hidden rounded-lg border border-line bg-[#eef6f2] shadow-map max-[920px]:min-h-[460px] max-sm:min-h-[330px]"
        aria-label="泡泡爪 Pet Spa 门店位置示意图，地址为上海市普陀区宜川路街道陕西北路 1620 号"
      >
        <Image
          className="object-contain"
          src="/assets/store-map-shaanxi-1620.png"
          alt="泡泡爪 Pet Spa 位于上海市普陀区宜川路街道陕西北路 1620 号的可爱宠物店风格地图"
          fill
          sizes="(max-width: 1160px) 100vw, 1160px"
        />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-white py-[26px] text-muted">
      <div className="mx-auto flex w-[min(1160px,calc(100%_-_32px))] items-center justify-between gap-4 text-sm max-sm:grid max-sm:w-[min(100%_-_24px,1160px)]">
        <span>© 2026 泡泡爪 Pet Spa</span>
        <span>一宠一档 · 一用一消毒 · 预约优先</span>
      </div>
    </footer>
  );
}

export default function Home() {
  const [bookingSubmitState, setBookingSubmitState] =
    useState<BookingSubmitState>("idle");
  const [toastMessage, setToastMessage] = useState("");
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, state: BookingSubmitState) => {
    setToastMessage(message);
    setBookingSubmitState(state);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setBookingSubmitState("idle");
    }, 2800);
  };

  const handleBookingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    setBookingSubmitState("submitting");

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.get("name"),
          phone: formData.get("phone"),
          arrivalTime: formData.get("arrivalTime"),
          pet: formData.get("pet"),
          service: formData.get("service"),
          note: formData.get("note"),
        }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;

        throw new Error(result?.message ?? "预约提交失败，请稍后再试。");
      }

      form.reset();
      showToast("预约信息已收到，门店会尽快联系你确认时间。", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "预约提交失败，请稍后再试。",
        "error",
      );
    }
  };

  return (
    <>
      <Header />
      <main id="top">
        <Hero
          onBookingSubmit={handleBookingSubmit}
          submitState={bookingSubmitState}
        />
        <Services />
        <Process />
        <Pricing />
        <EnvironmentCarousel />
        <Reviews />
        <Contact />
      </main>
      <Footer />
      <div
        className={`pointer-events-none fixed bottom-[18px] right-[18px] z-20 max-w-[340px] rounded-lg bg-night px-4 py-3.5 text-white shadow-soft transition ${
          bookingSubmitState === "success" || bookingSubmitState === "error"
            ? "translate-y-0 opacity-100"
            : "translate-y-6 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        {toastMessage}
      </div>
    </>
  );
}
