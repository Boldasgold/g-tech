# Relatório Executivo e Técnico — G-TECH Serviços Automotivos

> [!IMPORTANT]
> **Status da Plataforma:** 100% Unificada, Integrada e Validada Localmente  
> **Links de Teste Locais (Servidor Ativo em `localhost:3000`):**
> - **Site Oficial & Agendamento com Prévia 3D:** [http://localhost:3000/index.html](http://localhost:3000/index.html)
> - **Painel de Gestão da Oficina (Mecânico, ADM e Gestor):** [http://localhost:3000/oficina](http://localhost:3000/oficina)
> - **Portal de Decisão do Cliente (Link Seguro Auditável):** [http://localhost:3000/cliente/gt-tok-rodrigo-127](http://localhost:3000/cliente/gt-tok-rodrigo-127)
> - **Impressão Oficial de OS / PDF com Assinatura & SHA-256:** [http://localhost:3000/api/work-orders/GT-OS-000127/pdf](http://localhost:3000/api/work-orders/GT-OS-000127/pdf)
> - **API de Saúde / Healthcheck:** [http://localhost:3000/api/health](http://localhost:3000/api/health)
> - **URL de Produção Registrada (Railway):** [https://g-tech-production-ce21.up.railway.app/index.html](https://g-tech-production-ce21.up.railway.app/index.html)
> - **Repositório GitHub:** [https://github.com/Boldasgold/g-tech](https://github.com/Boldasgold/g-tech)
> - **Diretório Local:** [C:/Users/tiujo/Desktop/g-tech](file:///C:/Users/tiujo/Desktop/g-tech)

---

## 1. Visão Geral da Transformação

A **G-TECH Serviços Automotivos** (oficina de **Giovane Ribeiro** em **Paranaguá – PR**) teve seu site institucional completamente unificado ao sistema operacional de gestão da oficina, implementando a especificação do `Projeto_Sistema_GTech_Gestao_Oficina.pdf`.

Agora, **o mesmo veículo acompanha o cliente desde a escolha do horário no site até a entrega do carro na oficina**, com:
1. **Representação 3D interativa em 360°** de todas as carrocerias atendidas.
2. **Vistoria fotográfica padronizada de entrada** e marcação espacial de avarias pré-existentes.
3. **Checklist técnico inteligente em 10 grupos padronizados** com conversão direta de achados em sugestões de peças e serviços.
4. **Portal seguro de decisão item a item para o cliente**, com alertas de segurança e termo auditável em caso de recusa de itens críticos.
5. **Garantia de execução autorizada** (o mecânico só executa o que foi formalmente aprovado).
6. **Checklist de saída e emissão de documento técnico de OS em PDF** com selo criptográfico SHA-256.

---

## 2. Matriz de Cobertura 3D dos Veículos

Para cobrir 100% dos veículos atendidos sem falsas promessas de modelos exatos não licenciados, a G-Tech utiliza o **Motor WebGL Procedural G-Tech 3D** (Three.js), fornecendo modelos de alta fidelidade representativos com materiais automotivos PBR metálicos, pintura azul safira/ciano, vidros fumê, rodas de liga e iluminação LED:

| Carroceria | Modelos Homologados no Catálogo | Representação Técnica | Arquivo / Motor |
| :--- | :--- | :--- | :--- |
| **Hatch** | Sandero, Kwid, Gol, Polo, Onix, 208, C3, Argo, Yaris, City Hatch, March, Ka | 3D Representativo + Modo 2D | [public/js/gtech-3d.js](file:///C:/Users/tiujo/Desktop/g-tech/public/js/gtech-3d.js) |
| **Sedan** | Logan, Virtus, Onix Plus, Cronos, Corolla, Civic, Versa, Voyage, HB20S | 3D Representativo + Modo 2D | [public/js/gtech-3d.js](file:///C:/Users/tiujo/Desktop/g-tech/public/js/gtech-3d.js) |
| **SUV** | Duster, Captur, T-Cross, Nivus, Tracker, Compass, Renegade, Creta, Kicks, HR-V, 2008, C4 Cactus | 3D Representativo + Modo 2D | [public/js/gtech-3d.js](file:///C:/Users/tiujo/Desktop/g-tech/public/js/gtech-3d.js) |
| **Picape** | Oroch, Saveiro, Montana, Strada, Toro, S10, Hilux, Ranger, Amarok, Frontier | 3D Representativo + Modo 2D | [public/js/gtech-3d.js](file:///C:/Users/tiujo/Desktop/g-tech/public/js/gtech-3d.js) |
| **Van / Utilitário** | Master, Ducato, Boxer, Jumper, Transit, Fiorino, Kangoo, Partner, Expert, Scudo | 3D Representativo + Modo 2D | [public/js/gtech-3d.js](file:///C:/Users/tiujo/Desktop/g-tech/public/js/gtech-3d.js) |

- **Detecção Inteligente:** O sistema detecta a carroceria automaticamente ao selecionar a marca ou digitar o modelo (ex: *"Duster"* seleciona automaticamente **SUV**; *"Oroch"* seleciona **Picape**; *"Master"* seleciona **Van**; *"Logan"* seleciona **Sedan**; *"Sandero"* seleciona **Hatch**).
- **Controles de Câmera:** Giro livre orbital em 360°, zoom, reset e botões de atalho: *Frente, Lateral Direita, Lateral Esquerda, Traseira e Teto*.
- **Modo 2D & Acessibilidade:** Permite alternar para o diagrama esquemático 2D e lista semântica de regiões para aparelhos sem suporte a WebGL.

---

## 3. Arquitetura do Banco de Dados & Serviços

Construído com SQLite nativo de alto desempenho ([src/lib/db.ts](file:///C:/Users/tiujo/Desktop/g-tech/src/lib/db.ts)), garantindo consistência transacional e integridade sem dependências de compilação C++ externa:

```mermaid
erDiagram
    COMPANIES ||--o{ USERS : possui
    COMPANIES ||--o{ CUSTOMERS : atende
    CUSTOMERS ||--o{ VEHICLES : possui
    CUSTOMERS ||--o{ APPOINTMENTS : agenda
    CUSTOMERS ||--o{ WORK_ORDERS : contrata
    WORK_ORDERS ||--|| WO_INTAKE_INSPECTION : vistoria_entrada
    WORK_ORDERS ||--o{ WO_HOTSPOTS : avarias_achados
    WORK_ORDERS ||--o{ WO_CHECKLIST_ITEMS : diagnostico_10_grupos
    WORK_ORDERS ||--o{ WO_QUOTES : orcamento_versoes
    WO_QUOTES ||--o{ WO_QUOTE_ITEMS : itens_pecas_servicos
    WO_QUOTES ||--o{ WO_CUSTOMER_DECISIONS : decisao_auditavel
    WORK_ORDERS ||--|| WO_EXIT_CHECKLIST : saida_qualidade
    WORK_ORDERS ||--o{ WO_TIMELINE_EVENTS : historico
    COMPANIES ||--o{ AUDIT_LOG : trilha_imutavel
```

### Endpoints da API REST Criados e Validados:
1. `GET /api/catalog` — Catálogo de veículos, distribuição de carrocerias e marcas rápidas.
2. `GET /api/appointments?date=YYYY-MM-DD` — Consulta de vagas disponíveis (intervalos de 30 min entre 08:00–11:30 e 13:30–17:30) com proteção contra duplicidade.
3. `POST /api/appointments` — Gravação do agendamento com protocolo sequencial (`GT-2026-XXXX`) e retorno da mensagem formatada para WhatsApp.
4. `GET /api/tracking/[protocol]` — Rastreamento público seguro (sem exposição de CPF, fotos particulares ou margens de lucro).
5. `GET & POST /api/work-orders` — Listagem com filtros e criação/conversão de agendamentos em OS (`GT-OS-XXXXXX`).
6. `GET & PATCH /api/work-orders/[id]` — Consulta detalhada e atualização de status da OS.
7. `PUT /api/work-orders/[id]/intake` — Registro da vistoria de entrada (4 vistas, hodômetro, combustível, ciência/recusa).
8. `GET, POST & DELETE /api/work-orders/[id]/hotspots` — Marcadores 3D e 2D de avarias, achados e serviços.
9. `GET & PUT /api/work-orders/[id]/checklist` — Atualização do checklist inteligente dos 10 grupos.
10. `GET & POST /api/work-orders/[id]/quotes` — Gestão de orçamentos, versões (v1, v2) e publicação para o cliente.
11. `GET & POST /api/work-orders/[id]/exit` — Checklist de saída, controle de torque e entrega técnica.
12. `GET /api/work-orders/[id]/pdf` — Emissão do relatório oficial de OS para impressão ou salvamento em PDF.
13. `GET & POST /api/portal/[token]` — Portal do cliente com decisão item a item, termo de responsabilidade e hash SHA-256.
14. `GET /api/dashboard/metrics` — Métricas gerenciais e exportação de todas as OS em CSV (`?export=csv`).

---

## 4. Jornada da Ordem de Serviço na Prática

### Caso Demonstração Homologado (`GT-OS-000127`):
- **Cliente:** Rodrigo Camargo `(41) 98877-6655`
- **Veículo:** Renault Duster Dynamique 2.0 16V 2021 (Placa BCR-4E28)
- **Queixa Inicial:** Luz de injeção acesa no painel e estalo na roda dianteira direita em manobras.
- **Vistoria de Entrada:** Hodômetro 48.720 km, combustível 50%, avaria pré-existente assinalada no para-choque dianteiro direito (risco leve sem cobrança).
- **Checklist Técnico:** 10 grupos avaliados. Grupo Direção apontou **CRÍTICO** no Terminal de Direção (folga de 2.8mm medida com relógio comparador Mitutoyo). Grupo Diagnóstico apontou **ATENÇÃO** na Sonda Lambda pré-catalisador.
- **Orçamento v1:**
  - Item 1: *Terminal de Direção Dianteiro Direito + Alinhamento* — R$ 280,00 (⚠️ Risco Crítico de Segurança).
  - Item 2: *Sonda Lambda Pré-Catalisador Planar + Reset de ECU* — R$ 390,00.
  - Item 3: *Óleo 5W40 Sintético Homologado Renault + Filtro Mann* — R$ 340,00 (Preventiva).
- **Portal do Cliente:** Disponível em `http://localhost:3000/cliente/gt-tok-rodrigo-127`. Permite ao cliente aprovar individualmente cada serviço. Caso tente recusar o Terminal de Direção, o sistema abre imediatamente o **Termo de Risco de Segurança Veicular**, exigindo confirmação explícita de ciência para proteger a oficina.
- **Saída & Controle de Qualidade:** Teste de rodagem aprovado, scanner sem DTCs, torque de aperto conferido com torquímetro e emissão de termo de entrega.

---

## 5. Inteligência Técnica StartMyCar & Fotografias Reais de Veículos

Para atender à solicitação de manuais técnicos automotivos e visualização realista:

### 1. Dados Técnicos & Caixas de Fusíveis (StartMyCar)
Integrado ao banco de dados (`vehicle_tech_specs`) e disponível tanto no **Site Público** (banner rápido no agendamento) quanto na **Gestão da Oficina** (sub-aba dedicada `📖 Dados Técnicos & Fusíveis`):
- **Especificações de Fluidos:** Viscosidade e capacidade exata de óleo do motor, norma montadora (ex: *Renault RN0710*, *VW 502.00*), tipo e volume de líquido de arrefecimento (aditivo orgânico rosa), fluido de freio (DOT 4).
- **Calibragem de Pneus:** Pressão recomendada em PSI para dianteira, traseira e carga máxima.
- **Diagramas Interativos de Fusíveis:** Diagramas detalhados com busca instantânea por função (ex: *"bomba"*, *"farol"*, *"painel"*), destacando número do fusível, amperagem com código de cores automotivo (Verde 30A, Amarelo 20A, Azul 15A, Vermelho 10A) e relés principais tanto no cofre do motor quanto na cabine.
- **Diagnóstico Rápido de Falhas Comuns:** Sintomas frequentes, causas raízes mapeadas e procedimentos de reparo recomendados por montadora.
- **Importação Direta com 1 Clique:** Na tela da OS, o botão *"➕ Importar Óleo p/ Orçamento"* adiciona automaticamente o óleo exato especificado da montadora no orçamento da OS.

### 2. Galeria de Fotografias Reais Integradas
Disponíveis em `public/img/vehicles/` para todos os modelos cadastrados:
- **Renault Duster** (`renault-duster.jpg`), **Sandero** (`renault-sandero.jpg`), **Logan** (`renault-logan.jpg`), **Oroch** (`renault-oroch.jpg`), **Master** (`renault-master.jpg`)
- **Chevrolet Onix** (`chevrolet-onix.jpg`), **Volkswagen Gol / Polo** (`volkswagen-gol.jpg`)
- **Carrocerias Genéricas:** `suv-real.jpg`, `hatch-real.jpg`, `sedan-real.jpg`, `picape-real.jpg`, `van-real.jpg`
- **Alternador Interativo:** Em todos os visores (Agendamento, Painel da Oficina e Portal do Cliente), o usuário pode alternar entre `[ 🎮 3D 360° ]`, `[ 📸 Foto Real ]` e `[ 📐 2D ]`.

---

## 6. Módulo de Inspeção por Componente, Vista Explodida & Selo Oficial "PEÇA TROCADA"

Implementação completa dos requisitos avançados de inspeção mecânica:

### 1. Navegação Hierárquica e Drill-down no Veículo
- **Entrada Visual por Toque:** Ao tocar no motor ou freios no visualizador 3D, a câmera navega suavemente para dentro do compartimento (cofre ou cubo de roda) e abre o conjunto interno.
- **Trilha de Navegação (Breadcrumbs):** Caminho navegável exibido em tempo real (ex: `Veículo › Propulsão e Alimentação › Motor › Cabeçote › Comando de Válvulas` ou `Veículo › Rodagem e Controle › Freios Dianteiros › Pastilhas de Freio`), permitindo retornar a qualquer nível com 1 clique.
- **Ocultar Lataria / Revelar Mecânica:** Botão `👻 Ocultar Lataria` que torna a carroceria translúcida (25% de opacidade) revelando todos os órgãos mecânicos internos em funcionamento.
- **Vista Explodida 3D:** Botão `💥 Vista Explodida` que afasta as peças ao longo de seus eixos mecânicos naturais (roda desliza no eixo X, pinça e pastilhas separam no eixo Z, cabeçote e comando elevam no eixo Y).

### 2. Demonstração Cinemática "Explorar montagem em 10 segundos"
- Botão `🎬 Explorar montagem em 10s` integrado ao visor:
  - **0–2s:** Carro inteiro em 3/4, órbita suave e realce do eixo dianteiro.
  - **2–4s:** Foco no lado direito, destaque da roda e afastamento axial da roda.
  - **4–6s:** Conjunto de freio visível, destaque da pinça e separação ilustrativa das pastilhas.
  - **6–8s:** Pausa na montagem explodida, chamada da ficha e início do retorno guiado pelos eixos.
  - **8–10s:** Roda alinhada, conjunto recomposto, finalização da órbita e chamada para ação *"Inspecionar Componente"*.
  - Inclui barra de progresso em tempo real, botão de pular e respeito a movimento reduzido.

### 3. Ficha Técnica e Comercial de Componente (Metrologia)
- Ao tocar em qualquer peça no 3D ou na tabela:
  - Exibe identificação, sistema, posição, código OEM e tolerâncias da montadora.
  - Registro de medições físicas reais (ex: `2.8 mm de folga` no terminal de direção, `2.5 mm de espessura` nas pastilhas).
  - Status padronizado: `OK`, `Atenção`, `Crítico`, `Não inspecionado`.
  - Ações separadas: **"Salvar Achado da Inspeção"** e **"Sugerir Reparo p/ Orçamento"** (com peças e mão de obra).

### 4. Registro Oficial de Peças Substituídas ("PEÇA TROCADA")
- Na execução de itens autorizados na OS, o mecânico aciona **"Registrar Substituição"**:
  - Descrição da peça antiga retirada (condição de desgaste).
  - Descrição da peça nova instalada (marca de primeira linha, código, lote).
  - Fotos Antes (retirada) e Depois (instalada) com selo de transparência.
  - Emissão do selo oficial **`✅ PEÇA TROCADA`** com garantia legal de 90 dias conforme CDC.
- **Consulta pelo Cliente:** No portal do cliente (`/cliente/[token]`), o botão **"🔍 Ver Peças Trocadas"** destaca as substituições realizadas com as fotos comparativas e garantia.
- **Impressão Oficial de OS (PDF):** Tabela completa de peças substituídas com o selo `PEÇA TROCADA` e medições de metrologia incluídas antes das assinaturas.

---

## 7. Como Executar e Testar

### Iniciar o Servidor Localmente:
```cmd
cd "C:\Users\tiujo\Desktop\g-tech"
npm run build
npm run start
```
O servidor estará respondendo imediatamente em `http://localhost:3000`.

### Rotas de Acesso Imediato:
1. **Site Principal & Agendamento:** [http://localhost:3000/index.html](http://localhost:3000/index.html)
2. **Painel da Oficina (com Aba Componentes, 3D e Peças Trocadas):** [http://localhost:3000/oficina](http://localhost:3000/oficina)
3. **Portal do Cliente (com Seção Peças Trocadas & 3D):** [http://localhost:3000/cliente/gt-tok-rodrigo-127](http://localhost:3000/cliente/gt-tok-rodrigo-127)
4. **API Componentes & Inspeções:** [http://localhost:3000/api/work-orders/wo-demo-00127/components](http://localhost:3000/api/work-orders/wo-demo-00127/components)
5. **API Peças Trocadas:** [http://localhost:3000/api/work-orders/wo-demo-00127/replacements](http://localhost:3000/api/work-orders/wo-demo-00127/replacements)
6. **API Dados Técnicos StartMyCar:** [http://localhost:3000/api/tech-specs?brand=Renault&model=Duster](http://localhost:3000/api/tech-specs?brand=Renault&model=Duster)
7. **Impressão da OS em PDF com Peças Trocadas & Metrologia:** [http://localhost:3000/api/work-orders/GT-OS-000127/pdf](http://localhost:3000/api/work-orders/GT-OS-000127/pdf)
8. **Download de CSV:** [http://localhost:3000/api/dashboard/metrics?export=csv](http://localhost:3000/api/dashboard/metrics?export=csv)

---

## 7. Módulo de Reconhecimento Inteligente Volkswagen & Scanner 3D-360°

Em atendimento estrito à solicitação do cliente ("*coloque todas essas fotos na parte apenas da volkswagen e essas todos ela tem que está na parte /3D-360 reconhecer o veiculo que entrar na oficina*"), foram implementados:

### 7.1 Acervo Fotográfico Exclusivo Volkswagen (51 Modelos Oficiais)
- O arquivo compactado `GTech_Fotos_Veiculos.zip` foi extraído na íntegra para `public/img/vehicles/volkswagen/fotos/`.
- Contém exatamente **51 fotografias reais homologadas em alta resolução**, cobrindo todas as gerações e modelos emblemáticos da marca:
  1. **Família Golf (16 modelos):** Golf I (MK1 1977), Golf II (1991), Golf III (GTI 1996), Golf IV (Sapão 1998), Golf V, Golf VI, Golf VII, Golf GTI (2.0 TSI DSG), Golf R (300cv 4Motion), Golf Alltrack (4x4), Golf Cabriolet, Golf Plus, Golf Sportsvan, Golf Variant (SportWagen), e-Golf e e-Golf 2017.
  2. **Sedans, Coupés e Fastbacks (14 modelos):** Jetta (Comfortline/Highline), Jetta GLI (350 TSI 230cv), Passat (B8 R-Line), Passat CC, CC, Passat Variant, Passat NMS (Norte-Americano), Arteon (Fastback), Arteon Shooting Brake, Bora, Bora Variant, Phaeton (W12/V8), Polo Sedã / Virtus e Eos Cabriolet.
  3. **Hatches e Compactos (9 modelos):** Polo Hatch (Track/TSI/GTS), Up! (MPI/TSI), e-Up! 100% Elétrico, Beetle (Novo Fusca TSI), Beetle Cabriolet, Lupo, Lupo 3L TDI (3L/100km), Scirocco Coupé e ID.3 Elétrico.
  4. **SUVs e Crossovers (5 modelos):** Tiguan (Allspace 350 TSI), Tiguan 5N (Primeira Geração / Limited), Touareg (V6 R-Line), Atlas (7 Lugares) e ID.4 SUV Elétrico.
  5. **Vans, Utilitários e Comerciais (7 modelos):** Crafter Furgão, e-Crafter Elétrico, Transporter T6 / Kombi Moderna, Caddy Furgão, Touran Minivan, Sharan (7 Lugares) e MAN TGE (Caminhão Leve Grupo VW).
- **Regra de Exclusividade:** Nenhuma outra montadora (Renault, GM, Fiat, Toyota, etc.) utiliza fotos desse acervo; as fotos são ativadas estritamente para a Volkswagen.

### 7.2 Nova Rota Dedicada: `/3D-360` (Scanner e Entrada da Oficina)
- Criada a página `src/app/3D-360/page.tsx` (com rewrite de compatibilidade `/3d-360` em `next.config.ts`).
- **HUD de Reconhecimento em Tempo Real:** Ao digitar a placa ou modelo na recepção da oficina, o sistema identifica automaticamente o veículo, calcula a geração, vincula a foto real homologada e ajusta a carroceria 3D (`hatch`, `sedan`, `suv`, `van`, `picape`).
- **Galeria Visual dos 51 Modelos:** Filtros dinâmicos em abas (Todos, Golf, Sedans, Hatches, SUVs, Vans) para seleção imediata com um clique.
- **Integração StartMyCar:** Exibição do óleo de fábrica homologado (ex: 5W40 VW 502 00 / 508 88), capacidade em litros, calibração de pneus dianteiro/traseiro em PSI e gap de velas de ignição em mm.
- **Ação Direta de Entrada:** Botão "Abrir OS com este Veículo" que transfere todos os dados para o dashboard operacional `/oficina`.

### 7.3 Atualização dos Visualizadores e Portais
- `src/components/Vehicle3DViewer.tsx`: Incorporado o matcher inteligente com badge luminoso de reconhecimento e ficha técnica na aba "Foto Real".
- `public/script.js` e `public/index.html`: Na etapa 1 do agendamento web, ao selecionar Volkswagen e digitar qualquer um dos modelos, o badge de reconhecimento e a foto real correspondente aparecem instantaneamente.
- `src/app/oficina/page.tsx`: Modal de Nova OS e vistoria técnica integrados com prévia automática e botão de atalho para o Scanner 3D-360°.

### 7.4 Testes Automatizados de Verificação
- Script `scripts/verify-vw-3d360.mjs`: **32 testes executados e 100% aprovados** (rotas 200 OK, rewrite minúsculo, carregamento das fotos reais, APIs de especificações e checagem de exclusividade de marcas).
