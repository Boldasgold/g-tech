import { NextRequest, NextResponse } from "next/server";

const GTECH_SYSTEM_PROMPT = `Você é o "Assistente G-TECH", consultor técnico virtual da G-TECH Serviços Automotivos & Diagnóstico Avançado em Paranaguá - PR.
Responda sempre em português do Brasil, de forma prestativa, técnica, direta e profissional (máximo de 3 a 4 frases curtas por resposta).

INFORMAÇÕES OFICIAIS DA G-TECH SERVIÇOS AUTOMOTIVOS:
- Especialista Responsável: Giovane Ribeiro (Mais de 7 anos de experiência, Ex-Chefe de Oficina Renault, Professor de Mecânica e Elétrica Automotiva na Talentos Brasil, formação em Injeção Avançada, Elétrica Automotiva, Diagnósticos Avançados, Metrologia, Redes de Multiplexagem e Tecnologia Embarcada).
- Endereço: Rua Maria da Conceição Teixeira de Souza, 815, Oficina, Bairro Divinéia — Paranaguá - PR - CEP 83212-440.
- WhatsApp / Telefone: (41) 9652-2715 (+55 41 9652-2715).
- Instagram: @gtech.pgua (https://www.instagram.com/gtech.pgua).
- Especialidades e Serviços:
  1. Injeção Eletrônica & Scanner Avançado (luz de injeção acesa, falhas de ignição, consumo elevado, perda de potência, leitura de parâmetros em tempo real)
  2. Elétrica Automotiva & Baterias (alternador, motor de partida/arranque, fuga de corrente, curto-circuito, chicote elétrico, iluminação, baterias)
  3. Módulos, Central ECU & Redes de Multiplexagem (diagnóstico com osciloscópio, rede CAN/LIN, tecnologia embarcada, programação e reparo eletrônico)
  4. Mecânica Geral & Motor (correia dentada, cabeçote, sistema de arrefecimento, bombas, vazamentos, sensores e atuadores)
  5. Suspensão, Freios & ABS (pastilhas, discos, fluido de freio, diagnóstico de ABS/ESP, amortecedores)
  6. Revisão Preventiva & Troca de Óleo (revisão completa padrão concessionária, filtros, fluidos, check-up pré-viagem)
  7. Ar-Condicionado Automotivo (diagnóstico eletrônico do A/C, compressor, higienização)
  8. Diagnóstico Avançado com Osciloscópio e Metrologia de Precisão (solução precisa sem troca desnecessária de peças).

REGRAS DE ATENDIMENTO:
1. Não invente preços fechados sem avaliar o veículo; explique que a G-TECH trabalha com diagnóstico técnico de precisão para identificar a causa exata do defeito sem condenar peças no "achismo".
2. Oriente o cliente a fazer o Agendamento Rápido no painel principal do site ou chamar diretamente no WhatsApp (41) 9652-2715.`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function buildSmartAutomotiveReply(userText: string): string {
  const q = userText.toLowerCase();

  if (q.includes("endereço") || q.includes("endereco") || q.includes("onde fica") || q.includes("localiza") || q.includes("paranagua") || q.includes("paranaguá")) {
    return "A **G-TECH Serviços Automotivos** fica na **Rua Maria da Conceição Teixeira de Souza, 815 (Oficina), Bairro Divinéia — Paranaguá/PR (CEP 83212-440)**. Você pode agendar aqui pelo painel do site ou chamar no WhatsApp **(41) 9652-2715**!";
  }
  if (q.includes("giovane") || q.includes("quem") || q.includes("renault") || q.includes("história") || q.includes("historia")) {
    return "A G-TECH é liderada por **Giovane Ribeiro**, especialista com **+7 anos de experiência**, **Ex-Chefe de Oficina Renault** e **Professor de Mecânica e Elétrica Automotiva na Talentos Brasil**, com formação avançada em Injeção Eletrônica, Redes de Multiplexagem e Tecnologia Embarcada!";
  }
  if (q.includes("injeção") || q.includes("injecao") || q.includes("scanner") || q.includes("luz") || q.includes("falhando")) {
    return "Somos especialistas em **Injeção Eletrônica e Diagnóstico Avançado com Scanner e Osciloscópio**! Identificamos a causa exata de falhas, luz de injeção acesa ou perda de potência sem troca desnecessária de peças. Agende pelo painel acima ou chame no WhatsApp **(41) 9652-2715**!";
  }
  if (q.includes("elétrica") || q.includes("eletrica") || q.includes("bateria") || q.includes("partida") || q.includes("alternador")) {
    return "Realizamos diagnóstico completo de **Elétrica Automotiva, Baterias, Alternador, Motor de Partida, Fuga de Corrente e Redes CAN/Multiplexagem**. Selecione *Elétrica Automotiva* no Agendamento Rápido ou fale conosco no WhatsApp **(41) 9652-2715**!";
  }
  if (q.includes("preço") || q.includes("preco") || q.includes("valor") || q.includes("orçamento") || q.includes("orcamento")) {
    return "Trabalhamos com **diagnóstico técnico de precisão** para orçar exatamente o que o seu veículo precisa, com transparência total e padrão concessionária. Preencha o **Agendamento Rápido** na tela principal ou chame no WhatsApp **(41) 9652-2715**!";
  }

  return "Olá! Sou o **Assistente G-TECH**. Somos especialistas em **Diagnóstico Automotivo Avançado, Injeção Eletrônica, Elétrica, Redes de Multiplexagem e Mecânica** em Paranaguá/PR (Rua Maria da Conceição Teixeira de Souza, 815 - Divinéia). Me conte o que seu veículo apresenta ou chame no WhatsApp **(41) 9652-2715**!";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";

    if (!lastUserMsg.trim()) {
      return NextResponse.json({ reply: "Como posso ajudar com o seu veículo hoje?", source: "fallback" });
    }

    const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
    const preferredModels = [
      process.env.OLLAMA_MODEL || "llama3.2:latest",
      "gemma3:4b",
      "phi4-mini:latest",
    ];

    for (const model of preferredModels) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(`${ollamaUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            stream: false,
            options: { temperature: 0.4, num_predict: 220 },
            messages: [
              { role: "system", content: GTECH_SYSTEM_PROMPT },
              ...messages.slice(-8),
            ],
          }),
        });

        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const reply = data?.message?.content?.trim();
          if (reply) {
            return NextResponse.json({ reply, source: `ollama:${model}` });
          }
        }
      } catch {
        // fallback
      }
    }

    return NextResponse.json({
      reply: buildSmartAutomotiveReply(lastUserMsg),
      source: "fallback",
    });
  } catch {
    return NextResponse.json({
      reply: "Agende seu atendimento pelo painel do site ou fale direto no WhatsApp (41) 9652-2715!",
      source: "fallback",
    });
  }
}

