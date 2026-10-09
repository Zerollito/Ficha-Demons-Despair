import express from "express";
import http from "http";
import https from "https";
import { URL } from "url";
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

  // Supabase reverse proxy using native Node.js HTTP/HTTPS: allows mobile clients via Cloudflare Tunnel,
  // LAN, or remote domains to transparently communicate with the host PC's local Supabase without CORS,
  // Mixed Content, or extra tunnel ports, with zero external dependencies.
  const targetSupabase = (process.env.SUPABASE_INTERNAL_URL || process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321").trim();
  
  const createNativeSupabaseProxy = (targetBaseUrl: string, pathPrefixStrip?: string) => {
    return (req: express.Request, res: express.Response) => {
      try {
        const parsedTarget = new URL(targetBaseUrl);
        const isHttps = parsedTarget.protocol === 'https:';
        const clientLib = isHttps ? https : http;

        let targetPath = req.originalUrl || req.url;
        if (pathPrefixStrip && targetPath.startsWith(pathPrefixStrip)) {
          targetPath = targetPath.slice(pathPrefixStrip.length) || '/';
        }

        const headers: Record<string, string | string[] | undefined> = {
          ...req.headers,
          host: parsedTarget.host,
        };
        delete headers['content-length'];

        const proxyReq = clientLib.request({
          hostname: parsedTarget.hostname,
          port: parsedTarget.port || (isHttps ? 443 : 80),
          path: targetPath,
          method: req.method,
          headers: headers,
          timeout: 10000,
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err: any) => {
          if (!res.headersSent) {
            res.status(502).json({
              error: 'Supabase local indisponível no host.',
              details: err.message,
              code: 'PGRST_CONNECTION_REFUSED'
            });
          }
        });

        proxyReq.on('timeout', () => {
          proxyReq.destroy();
          if (!res.headersSent) {
            res.status(504).json({
              error: 'Gateway Timeout ao conectar com Supabase.',
              code: 'PGRST_GATEWAY_TIMEOUT'
            });
          }
        });

        req.pipe(proxyReq);
      } catch (err: any) {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Erro no proxy do Supabase', details: err.message });
        }
      }
    };
  };

  const supabaseProxy = createNativeSupabaseProxy(targetSupabase);

  // Mount Supabase standard routes BEFORE express.json() so body streaming is untouched
  app.use('/auth/v1', supabaseProxy);
  app.use('/rest/v1', supabaseProxy);
  app.use('/storage/v1', supabaseProxy);
  app.use('/realtime/v1', supabaseProxy);
  app.use('/functions/v1', supabaseProxy);
  app.use('/supabase-proxy', createNativeSupabaseProxy(targetSupabase, '/supabase-proxy'));

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

  // Supabase ping diagnostic endpoint
  app.get("/api/supabase/ping", async (req, res) => {
    const rawUrl = (req.query.url as string) || process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
    const anonKey = (req.query.key as string) || process.env.VITE_SUPABASE_ANON_KEY || "";
    let cleanUrl = rawUrl.trim();
    if (cleanUrl.endsWith("/")) cleanUrl = cleanUrl.slice(0, -1);
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "http://" + cleanUrl;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const start = Date.now();
      const headers: Record<string, string> = { "User-Agent": "DemonsDespair/1.12" };
      if (anonKey) headers["apikey"] = anonKey;

      const healthRes = await fetch(`${cleanUrl}/auth/v1/health`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;

      return res.json({
        online: healthRes.ok || healthRes.status < 500,
        status: healthRes.status,
        statusText: healthRes.statusText,
        latency,
        url: cleanUrl,
      });
    } catch (err: any) {
      return res.json({
        online: false,
        error: err.name === "AbortError" ? "Tempo limite de conexão esgotado (timeout 3.5s)" : (err.message || "Erro de rede"),
        url: cleanUrl,
      });
    }
  });

  // Campaign characters persistence store (failsafe across restarts and network disruptions)
  const CAMPAIGN_STORE_PATH = path.join(process.cwd(), "data", "campaign_characters_store.json");

  function getCampaignCharactersStore(): Record<string, any[]> {
    try {
      if (fs.existsSync(CAMPAIGN_STORE_PATH)) {
        const raw = fs.readFileSync(CAMPAIGN_STORE_PATH, "utf-8");
        return JSON.parse(raw) || {};
      }
    } catch (e) {
      console.error("[CampaignStore] Read error:", e);
    }
    return {};
  }

  function saveCampaignCharactersStore(data: Record<string, any[]>) {
    try {
      const dir = path.dirname(CAMPAIGN_STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CAMPAIGN_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error("[CampaignStore] Save error:", e);
    }
  }

  // VTT Table persistence store (tokens and map configs for real-time sub-second sync)
  const VTT_STORE_PATH = path.join(process.cwd(), "data", "vtt_store.json");

  function getVttStore(): Record<string, { tokens?: any[]; config?: any }> {
    try {
      if (fs.existsSync(VTT_STORE_PATH)) {
        const raw = fs.readFileSync(VTT_STORE_PATH, "utf-8");
        return JSON.parse(raw) || {};
      }
    } catch (e) {
      console.error("[VttStore] Read error:", e);
    }
    return {};
  }

  function saveVttStore(data: Record<string, { tokens?: any[]; config?: any }>) {
    try {
      const dir = path.dirname(VTT_STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(VTT_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error("[VttStore] Save error:", e);
    }
  }

  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM7JyUXp7fZ83VvlN-BRwsPIgtcqbyUTR21s-TqF4";

  // Dedicated VTT API: Get tokens and table config for a campaign
  app.get("/api/campaigns/:campaignId/vtt", async (req, res) => {
    const { campaignId } = req.params;
    if (!campaignId) return res.status(400).json({ error: "campaignId é obrigatório" });

    const store = getVttStore();
    const campVtt = store[campaignId] || { tokens: [], config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "" } };
    const tokenMap = new Map<string, any>();

    (campVtt.tokens || []).forEach((t: any) => {
      if (t && t.id) tokenMap.set(t.id, t);
    });

    let mergedConfig: any = { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", ...(campVtt.config || {}) };

    // Fetch directly from Supabase with SERVICE_ROLE_KEY to bypass RLS
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      // Fetch tokens
      const tokenRes = await fetch(`${targetSupabase}/rest/v1/tokens?campaign_id=eq.${encodeURIComponent(campaignId)}&select=*`, {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Accept: "application/json"
        },
        signal: controller.signal
      });

      if (tokenRes.ok) {
        const rows = await tokenRes.json();
        if (Array.isArray(rows)) {
          rows.forEach((row: any) => {
            const tkData = typeof row.data === "string" ? JSON.parse(row.data) : (row.data || {});
            const tkObj = { ...row, ...tkData, id: row.id };
            tokenMap.set(row.id, tkObj);
          });
        }
      }

      // Fetch config
      const configRes = await fetch(`${targetSupabase}/rest/v1/campaign_configs?campaign_id=eq.${encodeURIComponent(campaignId)}&select=*`, {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Accept: "application/json"
        },
        signal: controller.signal
      });

      if (configRes.ok) {
        const cRows = await configRes.json();
        if (Array.isArray(cRows)) {
          cRows.forEach((row: any) => {
            const cData = typeof row.data === "string" ? JSON.parse(row.data) : (row.data || {});
            const merged = { ...row, ...cData };
            const { id, campaign_id, campaignId: _, config_id, configId: __, data, updated_at, ...configProps } = merged;
            Object.assign(mergedConfig, configProps);
            if (merged.mapUrl || merged.map_url) {
              mergedConfig.mapUrl = merged.mapUrl || merged.map_url;
            }
          });
        }
      }

      clearTimeout(timeout);
    } catch (e: any) {
      console.warn("[API VTT] Supabase read warning:", e.message || e);
    }

    // Retain mapUrl from server memory/file store if query didn't return a non-empty mapUrl
    if (!mergedConfig.mapUrl && campVtt.config?.mapUrl) {
      mergedConfig.mapUrl = campVtt.config.mapUrl;
    }

    const tokens = Array.from(tokenMap.values());

    // Sync back to local store
    try {
      store[campaignId] = { tokens, config: mergedConfig };
      saveVttStore(store);
    } catch (e) {}

    return res.json({ success: true, tokens, config: mergedConfig });
  });

  // Dedicated VTT API: Add or update tokens
  app.post("/api/campaigns/:campaignId/vtt/tokens", async (req, res) => {
    const { campaignId } = req.params;
    const { token, tokens: bulkTokens } = req.body;

    if (!campaignId) return res.status(400).json({ error: "campaignId é obrigatório" });

    const store = getVttStore();
    const campVtt = store[campaignId] || { tokens: [], config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "" } };
    let currentTokens = campVtt.tokens || [];

    const incoming: any[] = bulkTokens && Array.isArray(bulkTokens) ? bulkTokens : (token ? [token] : []);
    if (incoming.length === 0) {
      return res.status(400).json({ error: "Nenhum token fornecido para salvar." });
    }

    for (const tk of incoming) {
      if (!tk || !tk.id) continue;
      currentTokens = [...currentTokens.filter((t: any) => t.id !== tk.id), tk];
    }

    campVtt.tokens = currentTokens;
    store[campaignId] = campVtt;
    saveVttStore(store);

    // Save to Supabase in background
    try {
      for (const tk of incoming) {
        if (!tk || !tk.id) continue;
        fetch(`${targetSupabase}/rest/v1/tokens`, {
          method: "POST",
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates"
          },
          body: JSON.stringify({
            id: tk.id,
            campaign_id: campaignId,
            data: tk,
            updated_at: new Date().toISOString()
          })
        }).catch(() => {});
      }
    } catch (e) {}

    return res.json({ success: true, count: currentTokens.length, tokens: currentTokens });
  });

  // Dedicated VTT API: Delete single token
  app.delete("/api/campaigns/:campaignId/vtt/tokens/:tokenId", async (req, res) => {
    const { campaignId, tokenId } = req.params;
    if (!campaignId || !tokenId) return res.status(400).json({ error: "campaignId e tokenId são obrigatórios" });

    const store = getVttStore();
    if (store[campaignId]) {
      store[campaignId].tokens = (store[campaignId].tokens || []).filter((t: any) => t.id !== tokenId);
      saveVttStore(store);
    }

    try {
      fetch(`${targetSupabase}/rest/v1/tokens?id=eq.${encodeURIComponent(tokenId)}`, {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
      }).catch(() => {});
    } catch (e) {}

    return res.json({ success: true, tokenId });
  });

  // Dedicated VTT API: Clear all tokens for campaign
  app.post("/api/campaigns/:campaignId/vtt/clear-tokens", async (req, res) => {
    const { campaignId } = req.params;
    if (!campaignId) return res.status(400).json({ error: "campaignId é obrigatório" });

    const store = getVttStore();
    if (store[campaignId]) {
      store[campaignId].tokens = [];
      saveVttStore(store);
    }

    try {
      fetch(`${targetSupabase}/rest/v1/tokens?campaign_id=eq.${encodeURIComponent(campaignId)}`, {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
      }).catch(() => {});
    } catch (e) {}

    return res.json({ success: true, campaignId });
  });

  // Dedicated VTT API: Update table config (mapUrl, gridSize, etc.)
  app.post("/api/campaigns/:campaignId/vtt/config", async (req, res) => {
    const { campaignId } = req.params;
    const { config } = req.body;

    if (!campaignId || !config) return res.status(400).json({ error: "campaignId e config são obrigatórios" });

    const store = getVttStore();
    const campVtt = store[campaignId] || { tokens: [], config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "" } };
    const updatedConfig = { ...(campVtt.config || {}), ...config, updatedAt: new Date().toISOString() };
    campVtt.config = updatedConfig;
    store[campaignId] = campVtt;
    saveVttStore(store);

    // Save map config to Supabase
    try {
      fetch(`${targetSupabase}/rest/v1/campaign_configs`, {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          id: `${campaignId}_map`,
          campaign_id: campaignId,
          config_id: "map",
          data: updatedConfig,
          mapUrl: updatedConfig.mapUrl || "",
          updated_at: new Date().toISOString()
        })
      }).catch(() => {});
    } catch (e) {}

    return res.json({ success: true, config: updatedConfig });
  });

  // Dedicated API: Get all characters linked to a campaign (bypasses RLS using service role and local store)
  app.get("/api/campaigns/:campaignId/characters", async (req, res) => {
    const { campaignId } = req.params;
    if (!campaignId) return res.status(400).json({ error: "campaignId é obrigatório" });

    const charMap = new Map<string, any>();

    // 1. Load from persistent disk store
    try {
      const store = getCampaignCharactersStore();
      const storedList = store[campaignId] || [];
      storedList.forEach((c: any) => {
        if (c && c.id) charMap.set(c.id, c);
      });
    } catch (e) {}

    // 2. Fetch directly from Supabase using SERVICE_ROLE_KEY (bypasses all RLS)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      // A. Fetch campaign details to get player emails and embedded characters
      const campRes = await fetch(`${targetSupabase}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}&select=*`, {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Accept: "application/json"
        },
        signal: controller.signal
      });

      let allowedEmails: string[] = [];
      if (campRes.ok) {
        const campDataList = await campRes.json();
        if (Array.isArray(campDataList) && campDataList.length > 0) {
          const campRow = campDataList[0];
          const cData = campRow.data || {};
          const pEmails = cData.playerEmails || campRow.player_emails || [];
          if (Array.isArray(pEmails)) {
            allowedEmails = pEmails.map((e: string) => (e || "").trim().toLowerCase()).filter(Boolean);
          }
          if (campRow.master_email) allowedEmails.push(campRow.master_email.trim().toLowerCase());
          if (cData.masterEmail) allowedEmails.push(cData.masterEmail.trim().toLowerCase());

          // Embeds inside campaign.data
          const embedded = cData.playerCharacters || cData.characters || [];
          if (Array.isArray(embedded)) {
            embedded.forEach((c: any) => {
              if (c && c.id) charMap.set(c.id, { ...c, campaignId });
            });
          }
        }
      }

      // B. Fetch characters where campaign_id = campaignId
      const charCampRes = await fetch(`${targetSupabase}/rest/v1/characters?campaign_id=eq.${encodeURIComponent(campaignId)}&select=*`, {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Accept: "application/json"
        },
        signal: controller.signal
      });

      if (charCampRes.ok) {
        const rows = await charCampRes.json();
        if (Array.isArray(rows)) {
          rows.forEach((row: any) => {
            const cData = typeof row.data === "string" ? JSON.parse(row.data) : (row.data || {});
            const charObj = { ...row, ...cData, id: row.id, campaignId };
            charMap.set(row.id, charObj);
          });
        }
      }

      // C. Also fetch characters belonging to player emails
      if (allowedEmails.length > 0) {
        const emailFilter = allowedEmails.map(e => `"${e}"`).join(',');
        const charEmailRes = await fetch(`${targetSupabase}/rest/v1/characters?user_email=in.(${encodeURIComponent(allowedEmails.join(','))})&select=*`, {
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            Accept: "application/json"
          },
          signal: controller.signal
        });

        if (charEmailRes.ok) {
          const emailRows = await charEmailRes.json();
          if (Array.isArray(emailRows)) {
            emailRows.forEach((row: any) => {
              const cData = typeof row.data === "string" ? JSON.parse(row.data) : (row.data || {});
              const charObj = { ...row, ...cData, id: row.id };
              // Include if it's already mapped, or if it has matching campaign_id or email
              if (charMap.has(row.id) || row.campaign_id === campaignId || !row.campaign_id) {
                charMap.set(row.id, { ...charObj, campaignId: row.campaign_id || campaignId });
              }
            });
          }
        }
      }

      clearTimeout(timeout);
    } catch (e: any) {
      console.warn("[API campaign characters] Supabase fetch warning:", e.message || e);
    }

    const characters = Array.from(charMap.values());
    
    // Update local disk cache with freshest state
    try {
      const store = getCampaignCharactersStore();
      store[campaignId] = characters;
      saveCampaignCharactersStore(store);
    } catch (e) {}

    return res.json({ success: true, count: characters.length, characters });
  });

  // Dedicated API: Link or save a character to a campaign
  app.post("/api/campaigns/:campaignId/characters", async (req, res) => {
    const { campaignId } = req.params;
    const { character } = req.body;

    if (!campaignId || !character || !character.id) {
      return res.status(400).json({ error: "campaignId e character com ID são obrigatórios." });
    }

    const cleanChar = { ...character, campaignId };

    // 1. Save to persistent disk store
    try {
      const store = getCampaignCharactersStore();
      const currentList = store[campaignId] || [];
      const updatedList = [...currentList.filter((c: any) => c.id !== cleanChar.id), cleanChar];
      store[campaignId] = updatedList;
      saveCampaignCharactersStore(store);
    } catch (e) {
      console.error("[API link character] Store error:", e);
    }

    // 2. Persist to Supabase using SERVICE_ROLE_KEY
    try {
      const targetUserId = cleanChar.userId || cleanChar.userEmail || "anonymous";
      const userEmail = (cleanChar.userEmail || "").trim().toLowerCase();

      // Upsert into characters table
      await fetch(`${targetSupabase}/rest/v1/characters`, {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          id: cleanChar.id,
          user_id: targetUserId,
          user_email: userEmail,
          campaign_id: campaignId,
          data: cleanChar,
          updated_at: new Date().toISOString()
        })
      });

      // Update campaign row data to include this character in playerCharacters list
      const campGetRes = await fetch(`${targetSupabase}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}&select=*`, {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Accept: "application/json"
        }
      });

      if (campGetRes.ok) {
        const campList = await campGetRes.json();
        if (Array.isArray(campList) && campList.length > 0) {
          const campRow = campList[0];
          const campData = campRow.data || {};
          let playerCharacters = campData.playerCharacters || [];
          if (!Array.isArray(playerCharacters)) playerCharacters = [];
          playerCharacters = [...playerCharacters.filter((c: any) => c.id !== cleanChar.id), cleanChar];

          let playerEmails = campData.playerEmails || [];
          if (!Array.isArray(playerEmails)) playerEmails = [];
          if (userEmail && !playerEmails.includes(userEmail)) {
            playerEmails.push(userEmail);
          }

          const updatedCampData = {
            ...campData,
            playerCharacters,
            playerEmails
          };

          await fetch(`${targetSupabase}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
            method: "PATCH",
            headers: {
              apikey: SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              data: updatedCampData,
              updated_at: new Date().toISOString()
            })
          });
        }
      }
    } catch (e: any) {
      console.warn("[API link character] Supabase write warning:", e.message || e);
    }

    return res.json({ success: true, character: cleanChar });
  });

  // Dedicated API: Unlink character from campaign
  app.post("/api/campaigns/:campaignId/unlink-character", async (req, res) => {
    const { campaignId } = req.params;
    const { characterId } = req.body;

    if (!campaignId || !characterId) {
      return res.status(400).json({ error: "campaignId e characterId são obrigatórios." });
    }

    // 1. Remove from disk store
    try {
      const store = getCampaignCharactersStore();
      if (store[campaignId]) {
        store[campaignId] = store[campaignId].filter((c: any) => c.id !== characterId);
        saveCampaignCharactersStore(store);
      }
    } catch (e) {}

    // 2. Remove campaign_id in Supabase
    try {
      await fetch(`${targetSupabase}/rest/v1/characters?id=eq.${encodeURIComponent(characterId)}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          campaign_id: null,
          updated_at: new Date().toISOString()
        })
      });

      // Update campaign's playerCharacters array
      const campGetRes = await fetch(`${targetSupabase}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}&select=*`, {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Accept: "application/json"
        }
      });

      if (campGetRes.ok) {
        const campList = await campGetRes.json();
        if (Array.isArray(campList) && campList.length > 0) {
          const campRow = campList[0];
          const campData = campRow.data || {};
          let playerCharacters = campData.playerCharacters || [];
          if (Array.isArray(playerCharacters)) {
            playerCharacters = playerCharacters.filter((c: any) => c.id !== characterId);
            const updatedCampData = { ...campData, playerCharacters };
            await fetch(`${targetSupabase}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
              method: "PATCH",
              headers: {
                apikey: SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                data: updatedCampData,
                updated_at: new Date().toISOString()
              })
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("[API unlink character] Supabase write warning:", e.message || e);
    }

    return res.json({ success: true, characterId });
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

  const server = http.createServer(app);

  // Handle WebSocket upgrades for Supabase Realtime
  server.on('upgrade', (req, socket, head) => {
    const url = req.url || '';
    if (url.startsWith('/realtime/v1') || url.startsWith('/supabase-proxy/realtime/v1')) {
      try {
        const parsedTarget = new URL(targetSupabase);
        const isHttps = parsedTarget.protocol === 'https:';
        const clientLib = isHttps ? https : http;
        
        let targetPath = url;
        if (targetPath.startsWith('/supabase-proxy')) {
          targetPath = targetPath.replace('/supabase-proxy', '') || '/';
        }

        const proxyReq = clientLib.request({
          hostname: parsedTarget.hostname,
          port: parsedTarget.port || (isHttps ? 443 : 80),
          path: targetPath,
          method: req.method,
          headers: {
            ...req.headers,
            host: parsedTarget.host,
          },
        });

        proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
          socket.write(`HTTP/1.1 101 Switching Protocols\r\n` +
            Object.entries(proxyRes.headers)
              .map(([k, v]) => `${k}: ${v}\r\n`)
              .join('') + '\r\n');
          if (proxyHead && proxyHead.length) {
            socket.unshift(proxyHead);
          }
          proxySocket.pipe(socket);
          socket.pipe(proxySocket);
        });

        proxyReq.on('error', () => {
          socket.destroy();
        });

        proxyReq.end();
      } catch (e) {
        socket.destroy();
      }
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
