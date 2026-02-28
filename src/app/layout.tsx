import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { Providers } from "@/lib/providers";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/sw-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PredictionDude",
  description: "AI-powered prediction market trading terminal",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased bg-cyber-bg text-[#e0e0f0] cyber-grid-bg cyber-ambient scanlines`}
      >
        <Providers>
          <ServiceWorkerRegister />
          <div className="relative z-10 flex min-h-screen">
            <Sidebar />
            <main className="flex-1 pl-0 pb-14 md:pl-16 md:pb-0">
              <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>
            <BottomNav />
          </div>
          <Toaster theme="dark" richColors />
        </Providers>
      </body>
    </html>
  );
}
