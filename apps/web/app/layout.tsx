import "./globals.css";
import { BrandingProvider } from "@/lib/branding";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/lib/session";
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
export const metadata: Metadata = {
  title: "Montara | Modbus Monitoring",
  description: "Manajemen gateway Modbus dan monitoring mesin.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        <BrandingProvider>
          <SessionProvider>{children}</SessionProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
