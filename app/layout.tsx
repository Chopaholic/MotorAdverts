import "./globals.css";
import type { Metadata } from "next";
import { Roboto_Condensed } from "next/font/google";
import { Suspense } from "react";
import ClientHeader from "@/components/ClientHeader";

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MotorAdverts",
  description: "Vehicle marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="bg-white text-neutral-900"
      style={{ ["--header-height" as any]: "7rem" }}
    >
      <body className={robotoCondensed.className}>
        {/* Suspense is required here because ClientHeader uses useSearchParams */}
        <Suspense fallback={null}>
          <ClientHeader />
        </Suspense>

        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>

        <footer className="mx-auto max-w-7xl px-4 py-10 text-xs text-neutral-500">
          © {new Date().getFullYear()} MotorAdverts
        </footer>
      </body>
    </html>
  );
}
