import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";

export const metadata: Metadata = {
  title: "Orbis Gestão | Estoque e Serviços",
  description: "Gestão profissional de estoque, ordens de serviço e faturamento.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Orbis" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head><meta name="theme-color" content="#111a2c" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
