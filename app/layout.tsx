import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { Toaster } from "sonner";

const soraLight = localFont({
  src: [
    {
      path: "../public/font/Sora-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/font/Sora-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-sora-light",
  display: "swap",
});

const kiments = localFont({
  src: "../public/font/logo/jen-wagner-co-versailles-regular.ttf",
  variable: "--font-kiments",
  weight: "400",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F0EDEB" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1A1A" },
  ],
};

export const metadata: Metadata = {
  title: "Kiments CRM",
  description: "CRM textil para conversaciones, contactos y reportes",
  applicationName: "Kiments CRM",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kiments",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/pwa/apple-icon-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${soraLight.variable} ${kiments.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <ServiceWorkerRegistrar />
            <Toaster richColors expand position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
