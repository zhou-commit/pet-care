type Metadata = {
  title?: string;
  description?: string;
};

import "./globals.css";

export const metadata: Metadata = {
  title: "泡泡爪 Pet Spa | 宠物洗护店",
  description:
    "泡泡爪 Pet Spa 为猫狗提供洗澡、精修、皮毛护理和幼宠适应服务。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: any;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
