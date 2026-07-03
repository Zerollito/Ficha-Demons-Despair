import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { MATERIALS } from "./src/data/materials";

dotenv.config();

// Dynamically query key on every call to support live-updates to environment secrets without server restart
function getGeminiClient(): GoogleGenAI {
  let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    throw new Error("Chave GEMINI_API_KEY não configurada ou vazia. Por favor, adicione-a em Settings (⚙️ no canto superior direito do Google AI Studio > Secrets).");
  }
  
  // Sanitize key (strip quotes, trim spaces and newlines/carriage returns)
  let cleanKey = apiKey.trim();
  if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
    cleanKey = cleanKey.slice(1, -1).trim();
  }
  if (cleanKey.startsWith("'") && cleanKey.endsWith("'")) {
    cleanKey = cleanKey.slice(1, -1).trim();
  }
  
  // Safe diagnostic log for model creators (no leaks on exact key values)
  console.log(`[Gemini Auth Check] Key Length: ${cleanKey.length}. Format valid: ${cleanKey.startsWith("AIzaSy") ? "YES (AIzaSy)" : "CHECK_PREFIX (" + cleanKey.substring(0, Math.min(6, cleanKey.length)) + ")"}`);

  return new GoogleGenAI({
    apiKey: cleanKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// Helper to dynamically read rules and instructions from files
function getSystemRules(): string {
  try {
    const rulesPath = path.join(process.cwd(), "SYSTEM_RULES.md");
    if (fs.existsSync(rulesPath)) {
      return fs.readFileSync(rulesPath, "utf-8");
    }
  } catch (err) {
    console.error("Error reading SYSTEM_RULES.md:", err);
  }
  return "Nenhuma regra extra encontrada.";
}

// Helper to format materials list from src/data/materials.ts
function getFormattedMaterials(): string {
  try {
    return MATERIALS.map(mat => {
      const corte = `${mat.corte.fisico}${mat.corte.magico ? " (mágico: " + mat.corte.magico + ")" : ""}`;
      const perf = `${mat.perfuracao.fisico}${mat.perfuracao.magico ? " (mágico: " + mat.perfuracao.magico + ")" : ""}`;
      const imp = `${mat.impacto.fisico}${mat.impacto.magico ? " (mágico: " + mat.impacto.magico + ")" : ""}`;
      const res = `${mat.resistencia.fisico}${mat.resistencia.magico ? " (mágico: " + mat.resistencia.magico + ")" : ""}`;
      const ligaInfo = mat.liga ? `, Liga: "${mat.liga}"` : "";
      const efeitosInfo = mat.efeitos.length > 0 ? `, Efeitos: ${JSON.stringify(mat.efeitos)}` : "";
      const ignorarInfo = mat.ignorarNoGerador ? " [Ignorar no Gerador]" : "";
      return `- ${mat.nome} [Corte: ${corte}, Perfuração: ${perf}, Impacto: ${imp}, Resistência: ${res}, Durabilidade: ${mat.durabilidade}${ligaInfo}${efeitosInfo}]${ignorarInfo}`;
    }).join("\n");
  } catch (err) {
    console.error("Error formatting materials:", err);
    return "Erro ao carregar materiais.";
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  app.get("/api/health", (req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      supabaseConfigured: !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== "placeholder_url"),
      supabaseUrlLength: supabaseUrl ? supabaseUrl.length : 0,
      supabaseUrlPrefix: supabaseUrl ? supabaseUrl.substring(0, 15) : "",
      geminiConfigured: !!geminiKey,
      geminiLength: geminiKey ? geminiKey.length : 0
    });
  });

  // chat oracle endpoint
  app.post("/api/oracle/chat", async (req, res) => {
    try {
      const { prompt, history, userContext } = req.body;
      const ai = getGeminiClient();
      const officialRules = getSystemRules();
      const dynamicMaterials = getFormattedMaterials();

      let sysInst = `Você é Hefesto, o sábio ferreiro divino do RPG de mesa "Demons Despair".
Como guardião e árbitro das regras e materiais oficiais do jogo, seu papel é sanar dúvidas mecânicas e forjar itens sob medida.

REGRAS ABSOLUTAS DE COMPORTAMENTO:
1. FIDELIDADE E IMPEDIMENTO DE SUPOSIÇÕES: Você DEVE se ater estritamente às regras oficiais fornecidas e aos materiais definidos nos dados do app. Nunca invente subregras, termos de combate fantasiosos (como supostas quebras de postura adicionais, ou penalidades/regras extras de desgaste de durabilidade), ou escalonamentos matemáticos arbitrários que não constem no material oficial fornecido. Se uma mecânica ou material não constar nos dados abaixo ou no SYSTEM_RULES.md, diga claramente que essa regra/material não existe no sistema oficial.
2. Respostas Curtas e Diretas: Responda em no máximo 1 ou 2 parágrafos curtos, respondendo de forma extremamente focada e concisa à dúvida ou item solicitado. Evite saudações excessivas, misticismo floreado redundante ou longas justificativas.
3. NUNCA invente materiais ou ligas fictícias (ex: "Aço Comum", "Aço Temperado", "Aço Estelar") ou de graus alternativos. Siga rigorosamente a lista de materiais.

LISTA COMPLETA DE TODOS OS MATERIAIS OFICIAIS DO "DEMONS DESPAIR" (QUAISQUER OUTROS NÃO MENCIONADOS AQUI NÃO EXISTEM):
${dynamicMaterials}

FÓRMULAS DE ARMAS OFICIAIS (CALCULE OS ATRIBUTOS DA ARMA BASEADO NO MATERIAL USANDO AS TABELAS ABAIXO):
- "Espada curta": { acerto: 12, dano: "1d8", escala: "D", atributoBase: "Destreza", corte: (material_corte * 1.0), impacto: (material_impacto * 0.33), perfuracao: (material_perfuracao * 1.0), durabilidade: (material_durabilidade * 1.0) }
- "Espada larga": { acerto: 16, dano: "1d12", escala: "C", atributoBase: "Força", corte: (material_corte * 1.0), impacto: (material_impacto * 0.66), perfuracao: (material_perfuracao * 0.66), durabilidade: (material_durabilidade * 1.0 + 1) }
- "Lança": { acerto: 16, dano: "2d6", escala: "D", atributoBase: "Destreza", corte: (material_corte * 0.33), impacto: 0, perfuracao: (material_perfuracao * 1.0 + 1), durabilidade: (material_durabilidade * 1.0) }
- "Adaga": { acerto: 10, dano: "1d4", escala: "D", atributoBase: "Destreza", corte: (material_corte * 1.0), impacto: 0, perfuracao: (material_perfuracao * 1.0), durabilidade: (material_durabilidade * 1.0) }
- "Maça": { acerto: 12, dano: "1d6+1d4", escala: "D", atributoBase: "Força", corte: 0, impacto: (material_impacto * 1.0), perfuracao: 0, durabilidade: (material_durabilidade * 1.0) }
- "Katana": { acerto: 12, dano: "2d6", escala: "C", atributoBase: "Destreza", corte: (material_corte * 1.0), impacto: 0, perfuracao: (material_perfuracao * 0.66), durabilidade: (material_durabilidade * 0.66) }
- "Machado grande": { acerto: 16, dano: "2d8", escala: "C", atributoBase: "Força", corte: (material_corte * 1.0), impacto: (material_impacto * 1.0 + 1), perfuracao: 0, durabilidade: (material_durabilidade * 1.0 + 1) }
- "Machado de mão": { acerto: 12, dano: "1d8", escala: "D", atributoBase: "Força", corte: (material_corte * 1.0), impacto: (material_impacto * 0.66), perfuracao: 0, durabilidade: (material_durabilidade * 1.0) }
- "Alabarda": { acerto: 16, dano: "2d6", escala: "C", atributoBase: "Força", corte: (material_corte * 0.66), impacto: (material_impacto * 0.66), perfuracao: (material_perfuracao * 0.66), durabilidade: (material_durabilidade * 1.0) }
- "Rapieira": { acerto: 12, dano: "2d4", escala: "C", atributoBase: "Destreza", corte: (material_corte * 0.33), impacto: 0, perfuracao: (material_perfuracao * 1.0 + 1), durabilidade: (material_durabilidade * 0.33) }
- "Martelo": { acerto: 14, dano: "1d12", escala: "D", atributoBase: "Força", corte: 0, impacto: (material_impacto * 1.0 + 1), perfuracao: 0, durabilidade: (material_durabilidade * 1.0 + 1) }
- "Espada curva": { acerto: 10, dano: "1d8", escala: "D", atributoBase: "Destreza", corte: (material_corte * 1.0), impacto: 0, perfuracao: 0, durabilidade: (material_durabilidade * 1.0) }
- "Tanto": { acerto: 10, dano: "1d6", escala: "D", atributoBase: "Destreza", corte: (material_corte * 1.0), impacto: 0, perfuracao: (material_perfuracao * 0.66), durabilidade: (material_durabilidade * 1.0) }
- "Katar": { acerto: 10, dano: "1d8+1d6", escala: "D", atributoBase: "Força", corte: (material_corte * 1.0), impacto: 0, perfuracao: (material_perfuracao * 1.0 + 1), durabilidade: (material_durabilidade * 1.0) }
- "Pilum": { acerto: 14, dano: "2d8", escala: "D", atributoBase: "Força", corte: 0, impacto: 0, perfuracao: (material_perfuracao * 1.0 + 2), durabilidade: 1 } /* O Pilum tem durabilidadeMult de 0, portanto sempre tem exatamente 1 de durabilidade útil */
- "Adaga antiarmadura": { acerto: 10, dano: "2d4", escala: "D", atributoBase: "Destreza", corte: (material_corte * 0.66), impacto: 0, perfuracao: (material_perfuracao * 1.0 + 2), durabilidade: (material_durabilidade * 1.0 - 2) }
- "Adaga quebra espada": { acerto: 10, dano: "2d4", escala: "D", atributoBase: "Destreza", corte: (material_corte * 1.0), impacto: 0, perfuracao: (material_perfuracao * 1.0), durabilidade: (material_durabilidade * 1.0 - 1) }
- "Arco curto": { acerto: 12, dano: "2d4", escala: "C", atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: (material_perfuracao * 1.0), durabilidade: (material_durabilidade * 1.0) }
- "Arco longo": { acerto: 10, dano: "2d6", escala: "C", atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: (material_perfuracao * 1.0), durabilidade: (material_durabilidade * 1.0) }
- "Arco recurvo": { acerto: 12, dano: "2d4", escala: "C", atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: (material_perfuracao * 1.0 + 1), durabilidade: (material_durabilidade * 1.0) }
- "Urumi": { acerto: 8, dano: "1d8", escala: "C", atributoBase: "Destreza", corte: (material_corte * 0.66), impacto: 0, perfuracao: 0, durabilidade: (material_durabilidade * 0.66) }
- "Mambele": { acerto: 14, dano: "1d8", escala: "D", atributoBase: "Destreza", corte: (material_corte * 1.0), impacto: (material_impacto * 0.2), perfuracao: (material_perfuracao * 0.66), durabilidade: (material_durabilidade * 1.0) }
- "Pistola flintlock": { acerto: 16, dano: "2d10", escala: "A", atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: (material_perfuracao * 1.0), durabilidade: (material_durabilidade * 2.0) }
- "Revólver": { acerto: 14, dano: "3d8", escala: "A", atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: (material_perfuracao * 1.0), durabilidade: (material_durabilidade * 2.0) }
- "Rifle flintlock": { acerto: 14, dano: "3d8", escala: "A", atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: (material_perfuracao * 1.0), durabilidade: (material_durabilidade * 2.0) }
- "Rifle": { acerto: 12, dano: "4d8", escala: "A", atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: (material_perfuracao * 1.0), durabilidade: (material_durabilidade * 2.0) }
- "Espingarda dupla": { acerto: 12, dano: "5d8", escala: "A", atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: (material_perfuracao * 1.0), durabilidade: (material_durabilidade * 1.5) }

DOCUMENTAÇÃO OFICIAL COMPLETA DAS REGRAS E MECÂNICAS (SIGA À RISCA, SEM DEVIAR OU ADIVINHAR):
${officialRules}

DIRETRIZ CRÍTICA DE CRIAÇÃO (JSON):
Se o usuário pedir para criar, forjar ou sugerir um item, você DEVE necessariamente fornecer um bloco de código JSON em markdown \`\`\`json ... \`\`\`.

SE O USUÁRIO PEDIR UMA "ARMADURA COMPLETA" OU "CONJUNTO COMPLETO DE ARMADURA" (COMO "ARMADURA DE PLACAS COMPLETA", "CONJUNTO DE COURO COMPLETO", ETC.):
Você DEVE OBRIGATORIAMENTE retornar uma LISTA (ARRAY JSON) contendo CADA PEÇA de armadura separadamente de acordo com as fórmulas oficiais de set abaixo, em vez de uma única peça com o nome do set.
O formato no caso de múltiplos itens deve ser obrigatoriamente um Array de pacotes de itens:
\`\`\`json
[
  {
    "tipoItem": "Armadura",
    "item": {
      "nome": "Peitoral de placas de Ferro",
      "peso": 70,
      "volume": 15,
      "durabilidade": 7,
      "maxDurabilidade": 7,
      "reducaoDano": -5,
      "corte": 4,
      "impacto": 0,
      "perfuracao": 2,
      "descricao": "Peça de peitoral de placas forjada por Hefesto."
    }
  },
  {
    "tipoItem": "Armadura",
    "item": {
      "nome": "Capacete de placas de Ferro",
      "peso": 35,
      "volume": 4,
      "durabilidade": 7,
      "maxDurabilidade": 7,
      "reducaoDano": -5,
      "corte": 4,
      "impacto": 0,
      "perfuracao": 2,
      "descricao": "Capacete de placas do conjunto de ferro."
    }
  }
]
\`\`\`

FÓRMULAS DE ARMADURAS OFICIAIS (CALCULE OS ATRIBUTOS DA PEÇA BASEADO NO MATERIAL):
Cada peça individual herda as proteções do material: corte = mat.corte.fisico, impacto = mat.impacto.fisico, perfuracao = mat.perfuracao.fisico.
O peso de cada peça é multiplicado por 2.0 se o material utilizado for pesado ("isPesado": true como Ferro/Osmium), e multiplicado por 0.5 se for leve como Vibrite/Feltro.
As partes que constituem cada tipo de conjunto completo de armadura são:

1. Conjunto de Placas (reducaoDano: -5, durabilidade e maxDurabilidade = material_durabilidade + 2):
   - "Peitoral de placas de [Material]" (peso base: 70 kg, volume: 15)
   - "Pernas de placas de [Material]" (peso base: 30 kg, volume: 8)
   - "Capacete de placas de [Material]" (peso base: 35 kg, volume: 4)
   - "Rebraço de placas de [Material]" (peso base: 20 kg, volume: 6)
   - "Manoplas de placas de [Material]" (peso base: 5 kg, volume: 2)
   - "Botas de placas de [Material]" (peso base: 5 kg, volume: 2)

2. Conjunto de Couro (reducaoDano: -1, durabilidade e maxDurabilidade = material_durabilidade):
   - "Peitoral parcial de [Material]" (peso base: 30 kg, volume: 10)
   - "Braçadeiras de [Material]" (peso base: 5 kg, volume: 6)
   - "Grevas de [Material]" (peso base: 15 kg, volume: 8)

3. Conjunto Simples (reducaoDano: -3, durabilidade e maxDurabilidade = material_durabilidade):
   - "Capacete de [Material]" (peso base: 30 kg, volume: 4)
   - "Peitoral parcial de [Material]" (peso base: 50 kg, volume: 10)
   - "Braçadeiras de [Material]" (peso base: 15 kg, volume: 6)
   - "Grevas de [Material]" (peso base: 20 kg, volume: 8)

4. Conjunto de Malha (reducaoDano: -2, durabilidade e maxDurabilidade = max(1, floor(material_durabilidade * 0.8))):
   - "Manto de malha de [Material]" (peso base: 30 kg, volume: 4)

REGRAS RÍGIDAS DE ATRIBUTOS DO JSON (SIGA SEMPRE, SEM EXCEÇÃO):
1. "corte", "impacto", "perfuracao" e "durabilidade": Devem ser calculados estritamente usando o Material e as Fórmulas fornecidas acima. NUNCA invente valores do nada.
2. "dano" de armas: O campo "dano" DEVE conter APENAS e estritamente a expressão de dados correspondente à arma (ex: "1d8", "2d6", etc.). NUNCA coloque "+FOR", "+DEX" ou qualquer bônus nos dados do dano.
3. "escala" e "atributoBase" de armas: Por padrão, a 'escala' de toda arma criada deve vir obrigatoriamente como "0" (escala: "0"), apenas identificando no campo 'atributoBase' com qual status a arma escala (por exemplo, "Força" ou "Destreza"). Nunca envie as letras "D", "C", "B" ou "A" como escala inicial padrão ao criar ou forjar uma arma. Ela deve vir como "0" e dizer o atributo correspondente.

Estrutura JSON esperada para um único item:
{
  "tipoItem": "Arma" | "Catalisador" | "Armadura" | "Acessório",
  "item": {
    "nome": "Espada Curta de Aço",
    "peso": 2.0,
    "volume": 3.0,
    "durabilidade": 4,
    "maxDurabilidade": 4,
    "descricao": "Uma espada curta de aço refinado divino por Hefesto.",
    "corte": 4,
    "impacto": 0,
    "perfuracao": 2,
    "resistencia": 1,
    "efeito": "Causa sangramento leve se acerto for perfeito.", // opcional
    
    // Se tipoItem for "Arma" adicione:
    "dano": "1d8",
    "acerto": 12,
    "tipo": "Arma",
    "categoria": "Arma Branca" | "Arma de Fogo" | "Arco",
    "escala": "0", // por padrão ao criar vem sempre como "0"
    "atributoBase": "Força" | "Destreza" | "Inteligência" | "Ritual",
    "municaoTotal": 0, // (caso seja de fogo)
    "municaoCarregada": 0, // (caso seja de fogo)

    // Se tipoItem for "Catalisador" adicione:
    "feitico": 3,
    "elemental": 2,
    "magiaNegra": 1,
    "potencial": 2,

    // Se tipoItem for "Armadura" adicione:
    "reducaoDano": -5 // deve ser o valor negativo correspondente ao set (ex: -5 para placas, -1 para couro, -3 para simples)
  }
}

Regras Cruciais do Sistema para Criação:
- Multiplicadores de Escala: 0, D(0.25x), C(0.5x), B(0.75x), A(1.0x).
- Atributos e vitais: Vida Máxima escorre de CON*2. Mana de APR*2. Carga máxima = 200 + (RES * 5).
- Localização de hit: 1-Braço Esquerdo, 2-Braço Direito, 3-Perna Esquerda, 4-Perna Direita, 5-Tronco, 6-Cabeça.
- Use as proficiências e escalizações do SYSTEM_RULES.md para criar o item.

Contexto do usuário atual: ${JSON.stringify(userContext || {})}.
Responda sempre em português.`;

      const contents = [];
      if (history && Array.isArray(history)) {
        for (const msg of history) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction: sysInst,
          temperature: 0.7,
        }
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("[Oracle API Error]:", err);
      let errorMsg = err.message || "Erro interno no Oráculo de Hefesto.";
      const errStr = String(err) + " " + (err.message || "") + " " + JSON.stringify(err);
      
      if (
        errStr.includes("API key not valid") || 
        errStr.includes("API_KEY_INVALID") || 
        errStr.includes("INVALID_ARGUMENT") ||
        errStr.includes("apiKey") ||
        err.status === 400 ||
        err.code === 400
      ) {
        errorMsg = "Sua chave de API do Gemini (GEMINI_API_KEY) é inválida ou não foi configurada nos segredos do projeto.\n\n👉 Para corrigir:\n1. Clique no ícone de engrenagem ⚙️ (Settings) no canto superior direito do Google AI Studio.\n2. Vá na aba 'Secrets'.\n3. Adicione uma nova variável com o nome 'GEMINI_API_KEY' com sua chave do Google AI.\n4. Recarregue a página!";
      }
      
      res.status(500).json({ error: errorMsg });
    }
  });

  // System diagnostic endpoint for error analysis
  app.post("/api/oracle/analyze", async (req, res) => {
    try {
      const ai = getGeminiClient();

      const analysisPrompt = `Você é um Analisador de Erros Inteligente de Engenharia de RPG para o sistema Demons Despair.
O mestre do jogo pediu para inspecionar, testar e analisar a harmonia estrutural do app no backend e frontend.

Por favor, faça um relatório de diagnóstico extremamente detalhado em Markdown focado em:
1. Consistência de Combate entre App.tsx (Ficha) e VTTBoard (resolveCombat).
2. Potenciais de bugs em React como: re-renders infinitos por useEffect mal estruturado, problemas com sincronização offline/online ou concorrência com Firebase.
3. Tratamento de operadores lógicos redundantes ou perigosos sem parênteses (ex: operadores mistos ?? e || que causam erros de tsc).
4. Erros graves ou pequenas melhorias na integridade lógica das regras do RPG Demons Despair (como o cálculo de bônus, escala D/C/B/A e níveis de durabilidade em contra-ataques).

Após listar os pontos problemáticos (tanto reais quanto preventivos baseados nas melhores práticas de React 19 e TypeScript), forneça uma seção chamada "PULSO DE CORREÇÃO" contendo um Prompt estruturado para cópia. Esse prompt deve ser perfeitamente estruturado para que um IA Coding Agent (Hefesto) possa ler e instantaneamente saber o que corrigir no código.

Escreva o relatório em português técnico, refinado, mas muito prático e prestativo para o Mestre do Jogo.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: analysisPrompt,
        config: {
          temperature: 0.4,
        }
      });

      res.json({ report: response.text });
    } catch (err: any) {
      console.error("[Analysis API Error]:", err);
      let errorMsg = err.message || "Erro ao rodar análise do Oráculo.";
      const errStr = String(err) + " " + (err.message || "") + " " + JSON.stringify(err);
      
      if (
        errStr.includes("API key not valid") || 
        errStr.includes("API_KEY_INVALID") || 
        errStr.includes("INVALID_ARGUMENT") ||
        errStr.includes("apiKey") ||
        err.status === 400 ||
        err.code === 400
      ) {
        errorMsg = "Sua chave de API do Gemini (GEMINI_API_KEY) é inválida ou não foi configurada nos segredos do projeto.\n\n👉 Para corrigir:\n1. Clique no ícone de engrenagem ⚙️ (Settings) no canto superior direito do Google AI Studio.\n2. Vá na aba 'Secrets'.\n3. Adicione uma nova variável com o nome 'GEMINI_API_KEY' com sua chave do Google AI.\n4. Recarregue a página!";
      }
      
      res.status(500).json({ error: errorMsg });
    }
  });

  // Production / Static
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
