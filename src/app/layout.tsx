import type { Metadata } from "next";

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
      <body style={{ margin: 0, background: "#05080f", color: "#f8fafc" }}>
        {children}
      </body>
    </html>
  );
}

