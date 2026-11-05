import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "G-TECH | Serviços Automotivos & Diagnóstico Avançado em Paranaguá - PR",
  description:
    "Especialista em Diagnóstico Automotivo Avançado, Injeção Eletrônica, Elétrica Automotiva, Módulos ECU, Redes CAN e Manutenção em Paranaguá - PR.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Orbitron:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body style={{ margin: 0, background: "#04070d", color: "#f8fafc", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

