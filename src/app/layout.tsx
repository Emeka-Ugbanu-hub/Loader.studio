import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#030303",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Loader.studio — Animated SVG Loader Generator",
  description:
    "Design pixel-grid animated loaders visually. Choose from spiral, wave, pulse presets or build custom animation paths. Export self-contained animated SVG — no JavaScript, no dependencies. Free, open source, and works entirely in the browser.",
  keywords: [
    "animated loader",
    "svg loader",
    "pixel loader",
    "loading animation",
    "spinner generator",
    "custom loader",
    "loader maker",
    "open source loader",
    "svg animation",
    "grid loader",
  ],
  authors: [{ name: "Emeka Ugbanu" }],
  creator: "Emeka Ugbanu",
  publisher: "Loader.studio",
  robots: { index: true, follow: true },
  metadataBase: new URL("https://emeka-ugbanu-hub.github.io"),
  alternates: {
    canonical: "/Loader.studio",
  },
  openGraph: {
    title: "Loader.studio — Animated SVG Loader Generator",
    description:
      "Design pixel-grid animated loaders visually. Choose presets or build custom paths. Export animated SVG — no JavaScript.",
    url: "https://emeka-ugbanu-hub.github.io/Loader.studio",
    siteName: "Loader.studio",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loader.studio — Animated SVG Loader Generator",
    description:
      "Design pixel-grid animated loaders visually. Export self-contained animated SVG.",
    creator: "@emekaugbanu",
  },
  icons: {
    icon: "/loader-studio-icon.svg",
    shortcut: "/loader-studio-icon.svg",
    apple: "/loader-studio-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
