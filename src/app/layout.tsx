import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { PwaRegister } from "@/components/layout/PwaRegister";
import { ShopTitle } from "@/components/layout/ShopTitle";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

// Metadatos genéricos: el mismo HTML se sirve para todas las barberías. El nombre del local
// lo pone <ShopTitle /> cuando llega el estado, y el manifiesto se arma por pedido.
export const metadata: Metadata = {
  title: {
    default: "BarberApp",
    template: "%s",
  },
  description: "Reservá tu turno, aboná la seña y sumá productos para retirar en el sillón.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1D4ED8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={jakarta.variable}>
      <body className="font-sans">
        <MotionProvider>
          {children}
          <Toaster />
        </MotionProvider>
        <PwaRegister />
        <ShopTitle />
      </body>
    </html>
  );
}
