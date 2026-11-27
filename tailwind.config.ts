import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        muted: "#697386",
        line: "#dde4ec",
        paper: "#fbfcfd",
        panel: "#ffffff",
        mint: "#8ed8c6",
        teal: "#0f7b75",
        coral: "#ff806b",
        sun: "#ffd66b",
        blue: "#5d89d7",
        night: "#142a33",
      },
      boxShadow: {
        soft: "0 18px 48px rgba(24, 33, 47, 0.12)",
        map: "0 18px 44px rgba(24, 33, 47, 0.08)",
      },
      fontFamily: {
        sans: [
          "Microsoft YaHei",
          "PingFang SC",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
