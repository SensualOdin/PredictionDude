import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Oracle - AI Prediction Assistant",
  description: "AI-powered prediction and bankroll distribution assistant powered by Google Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
