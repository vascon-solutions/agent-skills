import type { Metadata } from "next";
import config from "../roadmap-site.config.json";
import "./globals.css";

export const metadata: Metadata = {
  title: config.title,
  description: config.summary,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
