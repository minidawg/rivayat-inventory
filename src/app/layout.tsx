import type { Metadata } from "next";
import "./globals.css";
import { ThemeBootstrap } from "@/components/ThemeBootstrap";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Rivayat Fashion Lounge",
  description: "Inventory Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Playfair+Display:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased">
        <ThemeBootstrap />
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
