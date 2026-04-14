import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoCRO — Your Ads Speak. Make Your Pages Listen.",
  description:
    "AutoCRO reads your ad creative's intent and rewrites your landing page copy to match it — entirely locally with Ollama. No cloud APIs. Before/after evidence included.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#050812" />
      </head>
      <body>{children}</body>
    </html>
  );
}
