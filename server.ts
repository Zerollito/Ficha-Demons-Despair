import express from "express";
import http from "http";
import https from "https";
import { URL } from "url";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
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
  let targetSupabase = (process.env.SUPABASE_INTERNAL_URL || process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321").trim();
  let currentTargetSupabase = targetSupabase;
  
  const createNativeSupabaseProxy = (getTargetUrl: () => string, pathPrefixStrip?: string) => {
    return (req: express.Request, res: express.Response) => {
      try {
        const targetBaseUrl = getTargetUrl();
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

        // Garante que clientes mobile ou de túnel que enviem chave antiga ou vazia usem a anon key JWT padrão do Supabase local
        const defaultLocalKey = (process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNRebZhBc_4bXn6U").trim();
        const clientApiKey = (headers['apikey'] as string) || '';
        if (!clientApiKey || clientApiKey.startsWith('sb_publishable_')) {
          headers['apikey'] = defaultLocalKey;
          const authHeader = (headers['authorization'] as string) || '';
          if (!authHeader || authHeader.includes('sb_publishable_')) {
            headers['authorization'] = `Bearer ${defaultLocalKey}`;
          }
        }

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
              code: 'PGRST_CONNECTION_REFUSED',
              target: targetBaseUrl
            });
          }
        });

        proxyReq.on('timeout', () => {
          proxyReq.destroy();
          if (!res.headersSent) {
            res.status(504).json({
              error: 'Gateway Timeout ao conectar com Supabase.',
              code: 'PGRST_GATEWAY_TIMEOUT',
              target: targetBaseUrl
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

  const getTarget = () => currentTargetSupabase;
  const supabaseProxy = createNativeSupabaseProxy(getTarget);

  // Mount Supabase standard routes BEFORE express.json() so body streaming is untouched
  app.use('/auth/v1', supabaseProxy);
  app.use('/rest/v1', supabaseProxy);
  app.use('/storage/v1', supabaseProxy);
  app.use('/realtime/v1', supabaseProxy);
  app.use('/functions/v1', supabaseProxy);
  app.use('/supabase-proxy', createNativeSupabaseProxy(getTarget, '/supabase-proxy'));

  app.use(express.json({ limit: '10mb' }));

  app.get("/api/health", (req, res) => {
    const supabaseUrl = currentTargetSupabase;
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

  // Get current Supabase proxy configuration
  app.get("/api/supabase/config", (req, res) => {
    res.json({
      targetUrl: currentTargetSupabase,
      defaultAnonKey: (process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNRebZhBc_4bXn6U").trim()
    });
  });

  // Update Supabase proxy target URL dynamically
  app.post("/api/supabase/config", (req, res) => {
    const { targetUrl } = req.body || {};
    if (typeof targetUrl === 'string' && targetUrl.trim()) {
      let clean = targetUrl.trim();
      if (clean.endsWith("/")) clean = clean.slice(0, -1);
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) clean = "http://" + clean;
      currentTargetSupabase = clean;
      targetSupabase = clean;
      console.log(`📡 [Supabase Proxy] Alvo dinamicamente atualizado para: ${currentTargetSupabase}`);
      return res.json({ success: true, targetUrl: currentTargetSupabase });
    }
    res.status(400).json({ error: "URL inválida fornecida." });
  });

  // Supabase ping diagnostic endpoint with table readiness check
  app.get("/api/supabase/ping", async (req, res) => {
    const rawUrl = (req.query.url as string) || "";
    const anonKey = (req.query.key as string) || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNRebZhBc_4bXn6U";
    
    // Tenta primeiro testar a URL solicitada, depois localhost/127.0.0.1 e currentTargetSupabase
    const candidates: string[] = [];
    if (rawUrl) {
      let clean = rawUrl.trim();
      if (clean.endsWith("/")) clean = clean.slice(0, -1);
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) clean = "http://" + clean;
      candidates.push(clean);
    }
    if (!candidates.includes(currentTargetSupabase)) {
      candidates.push(currentTargetSupabase);
    }
    if (!candidates.includes("http://127.0.0.1:54321")) {
      candidates.push("http://127.0.0.1:54321");
    }
    if (!candidates.includes("http://localhost:54321")) {
      candidates.push("http://localhost:54321");
    }

    let lastError = "Erro ao conectar com Supabase";
    for (const testUrl of candidates) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const start = Date.now();
        const headers: Record<string, string> = { "User-Agent": "DemonsDespair/1.14.3" };
        if (anonKey) headers["apikey"] = anonKey;

        const healthRes = await fetch(`${testUrl}/auth/v1/health`, {
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latency = Date.now() - start;

        if (healthRes.ok || healthRes.status < 500) {
          // Check if table 'characters' exists by doing a quick limit 1 select
          let tablesReady = false;
          let tableMsg = "";
          try {
            const tableCtrl = new AbortController();
            const tableTimeout = setTimeout(() => tableCtrl.abort(), 2500);
            const tableRes = await fetch(`${testUrl}/rest/v1/characters?select=id&limit=1`, {
              headers: { ...headers, "Authorization": `Bearer ${anonKey}` },
              signal: tableCtrl.signal
            });
            clearTimeout(tableTimeout);
            if (tableRes.ok) {
              tablesReady = true;
            } else {
              const body = await tableRes.json().catch(() => ({}));
              if (body.code === '42P01' || body.message?.includes('does not exist')) {
                tablesReady = false;
                tableMsg = "Tabela 'characters' não encontrada. Execute supabase_setup.sql no SQL Editor do Supabase.";
              } else {
                // Table exists but maybe RLS or empty
                tablesReady = true;
              }
            }
          } catch (tErr) {
            tablesReady = true; // Assume true if auth responded
          }

          return res.json({
            online: true,
            status: healthRes.status,
            latency,
            url: testUrl,
            hostDirect: testUrl === currentTargetSupabase,
            tablesReady,
            tableMessage: tableMsg || (tablesReady ? "Tabelas verificadas com sucesso." : undefined)
          });
        }
      } catch (err: any) {
        lastError = err.name === "AbortError" ? "Tempo limite esgotado (timeout 3.5s)" : (err.message || "Erro de rede");
      }
    }

    return res.json({
      online: false,
      error: lastError,
      url: currentTargetSupabase,
    });
  });

  // Campaign characters persistence store (failsafe across restarts and network disruptions)
  const CAMPAIGN_STORE_PATH = path.join(process.cwd(), "data", "campaign_characters_store.json");
  const CAMPAIGNS_STORE_PATH = path.join(process.cwd(), "data", "campaigns_store.json");

  function getCampaignsStore(): Record<string, any> {
    try {
      if (fs.existsSync(CAMPAIGNS_STORE_PATH)) {
        const raw = fs.readFileSync(CAMPAIGNS_STORE_PATH, "utf-8");
        return JSON.parse(raw) || {};
      }
    } catch (e) {
      console.error("[CampaignsStore] Read error:", e);
    }
    return {};
  }

  function saveCampaignsStore(data: Record<string, any>) {
    try {
      const dir = path.dirname(CAMPAIGNS_STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CAMPAIGNS_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error("[CampaignsStore] Save error:", e);
    }
  }

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
  let vttStoreCache: Record<string, { tokens?: any[]; config?: any }> | null = null;
  let saveVttTimer: any = null;

  function getVttStore(): Record<string, { tokens?: any[]; config?: any }> {
    if (vttStoreCache) return vttStoreCache;
    try {
      if (fs.existsSync(VTT_STORE_PATH)) {
        const raw = fs.readFileSync(VTT_STORE_PATH, "utf-8");
        vttStoreCache = JSON.parse(raw) || {};
        return vttStoreCache!;
      }
    } catch (e) {
      console.error("[VttStore] Read error:", e);
    }
    vttStoreCache = {};
    return vttStoreCache;
  }

  function saveVttStore(data: Record<string, { tokens?: any[]; config?: any }>) {
    vttStoreCache = data;
    // Debounce disk writes to never block the event loop or real-time broadcasts
    if (saveVttTimer) clearTimeout(saveVttTimer);
    saveVttTimer = setTimeout(async () => {
      try {
        const dir = path.dirname(VTT_STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        await fs.promises.writeFile(VTT_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
      } catch (e) {
        console.error("[VttStore] Save error:", e);
      }
    }, 250);
  }

  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM7JyUXp7fZ83VvlN-BRwsPIgtcqbyUTR21s-TqF4";

  // Circuit breaker for Supabase connectivity: prevents unhandled fetch errors,
  // request latency/timeouts, and log pollution when Supabase or its tunnel is offline.
  let isSupabaseOnline = false;
  let lastSupabaseHealthCheck = 0;
  const SUPABASE_CHECK_COOLDOWN = 30000; // Check at most once every 30s

  async function isSupabaseReachable(): Promise<boolean> {
    const now = Date.now();
    if (now - lastSupabaseHealthCheck < SUPABASE_CHECK_COOLDOWN) {
      return isSupabaseOnline;
    }
    lastSupabaseHealthCheck = now;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 800);
      const res = await fetch(`${targetSupabase}/auth/v1/health`, {
        headers: { apikey: SERVICE_ROLE_KEY },
        signal: controller.signal,
      });
      clearTimeout(t);
      isSupabaseOnline = res.ok || res.status < 500;
    } catch {
      isSupabaseOnline = false;
    }
    return isSupabaseOnline;
  }

  // Real-time VTT Event Stream & WebSocket Manager for sub-10ms instant multi-player sync
  const vttClients = new Map<string, Set<express.Response>>();
  const vttWsClients = new Map<string, Set<WebSocket>>();
  const vttWss = new WebSocketServer({ noServer: true });

  function broadcastVtt(campaignId: string, payload: { type: string; tokens?: any[]; config?: any; tokenId?: string; x?: number; y?: number; senderId?: string }, excludeWs?: WebSocket) {
    const rawData = JSON.stringify(payload);

    // 1. Instant WebSocket broadcast (zero proxy buffering, <1ms latency)
    const wsSet = vttWsClients.get(campaignId);
    if (wsSet && wsSet.size > 0) {
      wsSet.forEach((wsClient) => {
        try {
          if (wsClient !== excludeWs && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(rawData);
          }
        } catch {
          wsSet.delete(wsClient);
        }
      });
    }

    // 2. High-speed SSE broadcast with explicit flush
    const clients = vttClients.get(campaignId);
    if (clients && clients.size > 0) {
      const data = `data: ${rawData}\n\n`;
      clients.forEach((client) => {
        try {
          client.write(data);
          if (typeof (client as any).flush === 'function') {
            (client as any).flush();
          }
        } catch {
          clients.delete(client);
        }
      });
    }
  }

  // Periodic heartbeat every 15s to keep WebSocket connections open and alive through proxies
  setInterval(() => {
    vttWsClients.forEach((set) => {
      set.forEach((wsClient) => {
        try {
          if (wsClient.readyState === WebSocket.OPEN) {
            wsClient.ping();
          } else {
            set.delete(wsClient);
          }
        } catch {
          set.delete(wsClient);
        }
      });
    });
  }, 15000);

  // Handle VTT WebSocket connections
  vttWss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    console.log(`[DEBUG][VTT] Connection handler triggered for ${req.url}`);
    try {
      const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const campaignId = parsedUrl.searchParams.get('campaignId') || '';
      if (!campaignId) {
        ws.close(1008, 'campaignId required');
        return;
      }

      if (!vttWsClients.has(campaignId)) {
        vttWsClients.set(campaignId, new Set());
      }
      const set = vttWsClients.get(campaignId)!;
      set.add(ws);

      // Send immediate table state on connect
      const store = getVttStore();
      const campVtt = store[campaignId] || { tokens: [], config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", gridColor: "#000000" } };
      const initialPayload = {
        type: "vtt_init",
        tokens: campVtt.tokens || [],
        config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", gridColor: "#000000", ...(campVtt.config || {}) }
      };
      try {
        ws.send(JSON.stringify(initialPayload));
      } catch {}

      // Fast-path incoming messages from clients
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          const currentStore = getVttStore();
          const currentCampVtt = currentStore[campaignId] || { tokens: [], config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", gridColor: "#000000" } };

          // Instant Live Drag Movement: updates memory and immediately informs peers without disk blocking
          if (msg.type === 'token_live_move') {
            const { tokenId, x, y, senderId } = msg;
            if (tokenId && typeof x === 'number' && typeof y === 'number') {
              let list = currentCampVtt.tokens || [];
              const idx = list.findIndex((t: any) => t.id === tokenId);
              if (idx !== -1) {
                list[idx] = { ...list[idx], x, y };
                currentCampVtt.tokens = list;
                currentStore[campaignId] = currentCampVtt;
              }
              broadcastVtt(campaignId, { type: "token_live_move", tokenId, x, y, senderId }, ws);
            }
            return;
          }

          if (msg.type === 'token_move' || msg.type === 'update_tokens' || msg.type === 'token_add' || msg.type === 'add_token') {
            const incomingTokens = msg.tokens || (msg.token ? [msg.token] : []);
            if (incomingTokens.length > 0) {
              let list = currentCampVtt.tokens || [];
              for (const tk of incomingTokens) {
                if (!tk || !tk.id) continue;
                list = [...list.filter((t: any) => t.id !== tk.id), tk];
              }
              currentCampVtt.tokens = list;
              currentStore[campaignId] = currentCampVtt;

              // 1. Instant zero-delay broadcast to all other players (< 1ms)
              broadcastVtt(campaignId, { type: "vtt_tokens", tokens: list, config: currentCampVtt.config }, ws);

              // 2. Debounced asynchronous file persist
              saveVttStore(currentStore);

              // 3. Background mirror to Supabase
              try {
                for (const tk of incomingTokens) {
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
              } catch {}
            }
          } else if (msg.type === 'token_remove' || msg.type === 'remove_token') {
            const tokenId = msg.tokenId || (msg.token && msg.token.id);
            if (tokenId) {
              currentCampVtt.tokens = (currentCampVtt.tokens || []).filter((t: any) => t.id !== tokenId);
              currentStore[campaignId] = currentCampVtt;

              broadcastVtt(campaignId, { type: "vtt_tokens", tokens: currentCampVtt.tokens, config: currentCampVtt.config });
              saveVttStore(currentStore);

              try {
                fetch(`${targetSupabase}/rest/v1/tokens?id=eq.${encodeURIComponent(tokenId)}`, {
                  method: "DELETE",
                  headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
                }).catch(() => {});
              } catch {}
            }
          } else if (msg.type === 'clear_tokens') {
            currentCampVtt.tokens = [];
            currentStore[campaignId] = currentCampVtt;
            broadcastVtt(campaignId, { type: "vtt_tokens", tokens: [], config: currentCampVtt.config });
            saveVttStore(currentStore);
          } else if (msg.type === 'update_config') {
            if (msg.config) {
              const updatedConfig = { ...(currentCampVtt.config || {}), ...msg.config, updatedAt: new Date().toISOString() };
              currentCampVtt.config = updatedConfig;
              currentStore[campaignId] = currentCampVtt;

              broadcastVtt(campaignId, { type: "vtt_config", tokens: currentCampVtt.tokens || [], config: updatedConfig });
              saveVttStore(currentStore);
            }
          }
        } catch (err) {
          console.warn('[VTT WS message error]', err);
        }
      });

      ws.on('close', () => {
        set.delete(ws);
        if (set.size === 0) vttWsClients.delete(campaignId);
      });

      ws.on('error', () => {
        set.delete(ws);
      });
    } catch (e) {
      console.warn('[VTT WS connection error]', e);
    }
  });

  // SSE Stream endpoint: provides instant push updates whenever tokens or table config change
  app.get("/api/campaigns/:campaignId/vtt/stream", (req, res) => {
    const { campaignId } = req.params;
    if (!campaignId) return res.status(400).end();

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });

    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    // Anti-buffering padding for cloud reverse proxies and Cloud Run
    res.write(`: ${".".repeat(1024)}\n\n`);
    res.write(": connected\n\n");
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }

    if (!vttClients.has(campaignId)) {
      vttClients.set(campaignId, new Set());
    }
    const set = vttClients.get(campaignId)!;
    set.add(res);

    // Send immediate state on connect
    const store = getVttStore();
    const campVtt = store[campaignId] || { tokens: [], config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", gridColor: "#000000" } };
    const initialPayload = {
      type: "vtt_init",
      tokens: campVtt.tokens || [],
      config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", gridColor: "#000000", ...(campVtt.config || {}) }
    };
    try {
      res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch {}

    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      } catch {
        clearInterval(heartbeat);
      }
    }, 10000);

    req.on("close", () => {
      clearInterval(heartbeat);
      set.delete(res);
      if (set.size === 0) {
        vttClients.delete(campaignId);
      }
    });
  });

  // Dedicated VTT API: Get tokens and table config for a campaign (sub-millisecond instant memory return)
  app.get("/api/campaigns/:campaignId/vtt", async (req, res) => {
    const { campaignId } = req.params;
    if (!campaignId) return res.status(400).json({ error: "campaignId é obrigatório" });

    const store = getVttStore();
    const campVtt = store[campaignId] || { tokens: [], config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", gridColor: "#000000" } };
    
    const tokens = campVtt.tokens || [];
    const mergedConfig = { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", gridColor: "#000000", ...(campVtt.config || {}) };

    // Background seed from Supabase ONLY if store has no data yet
    if (!store[campaignId] && await isSupabaseReachable()) {
      (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1500);
          const tokenRes = await fetch(`${targetSupabase}/rest/v1/tokens?campaign_id=eq.${encodeURIComponent(campaignId)}&select=*`, {
            headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Accept: "application/json" },
            signal: controller.signal
          });
          if (tokenRes.ok) {
            const rows = await tokenRes.json();
            if (Array.isArray(rows) && rows.length > 0) {
              const currentStore = getVttStore();
              if (!currentStore[campaignId] || !currentStore[campaignId].tokens || currentStore[campaignId].tokens.length === 0) {
                const loadedTokens = rows.map((r: any) => ({ ...(typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {})), id: r.id }));
                currentStore[campaignId] = { ...(currentStore[campaignId] || {}), tokens: loadedTokens };
                saveVttStore(currentStore);
                broadcastVtt(campaignId, { type: "vtt_tokens", tokens: loadedTokens, config: currentStore[campaignId].config });
              }
            }
          }
          clearTimeout(timeout);
        } catch {}
      })();
    }

    return res.json({ success: true, tokens, config: mergedConfig });
  });

  // Dedicated VTT API: Ultra-fast live token position broadcast during drag
  app.post("/api/campaigns/:campaignId/vtt/live-move", (req, res) => {
    const { campaignId } = req.params;
    const { tokenId, x, y, senderId } = req.body;
    if (!campaignId || !tokenId) return res.status(400).end();

    const store = getVttStore();
    const campVtt = store[campaignId] || { tokens: [], config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", gridColor: "#000000" } };
    let list = campVtt.tokens || [];
    const idx = list.findIndex((t: any) => t.id === tokenId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], x, y };
      campVtt.tokens = list;
      store[campaignId] = campVtt;
    }
    broadcastVtt(campaignId, { type: "token_live_move", tokenId, x, y, senderId });
    return res.json({ success: true });
  });

  // Dedicated VTT API: Add or update tokens
  app.post("/api/campaigns/:campaignId/vtt/tokens", async (req, res) => {
    const { campaignId } = req.params;
    const { token, tokens: bulkTokens } = req.body;

    if (!campaignId) return res.status(400).json({ error: "campaignId é obrigatório" });

    const store = getVttStore();
    const campVtt = store[campaignId] || { tokens: [], config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", gridColor: "#000000" } };
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

    // Instant zero-latency SSE push to all other players in this campaign
    broadcastVtt(campaignId, { type: "vtt_tokens", tokens: currentTokens, config: campVtt.config });

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
      // Instant SSE broadcast
      broadcastVtt(campaignId, { type: "vtt_tokens", tokens: store[campaignId].tokens || [], config: store[campaignId].config });
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
      // Instant SSE broadcast
      broadcastVtt(campaignId, { type: "vtt_tokens", tokens: [], config: store[campaignId].config });
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
    const campVtt = store[campaignId] || { tokens: [], config: { gridSize: 50, showGrid: true, masterFog: false, mapUrl: "", gridColor: "#000000" } };
    const updatedConfig = { ...(campVtt.config || {}), ...config, updatedAt: new Date().toISOString() };
    campVtt.config = updatedConfig;
    store[campaignId] = campVtt;
    saveVttStore(store);

    // Instant SSE broadcast
    broadcastVtt(campaignId, { type: "vtt_config", tokens: campVtt.tokens || [], config: updatedConfig });

    // Save map config to Supabase in background
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

  // Dedicated Campaign Management APIs
  // 1. Get all campaigns (merges disk store and Supabase)
  app.get("/api/campaigns", async (req, res) => {
    const { masterEmail, playerEmail } = req.query;
    const cleanMaster = masterEmail ? String(masterEmail).trim().toLowerCase() : "";
    const cleanPlayer = playerEmail ? String(playerEmail).trim().toLowerCase() : "";

    const campMap = new Map<string, any>();

    // Load from disk store first
    try {
      const store = getCampaignsStore();
      Object.values(store).forEach((camp: any) => {
        if (camp && camp.id) {
          campMap.set(camp.id, camp);
        }
      });
    } catch (e) {}

    // Merge from Supabase if online
    if (await isSupabaseReachable()) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const campRes = await fetch(`${targetSupabase}/rest/v1/campaigns?select=*`, {
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            Accept: "application/json"
          },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (campRes.ok) {
          const rows = await campRes.json();
          if (Array.isArray(rows)) {
            rows.forEach((row: any) => {
              const cData = typeof row.data === "string" ? JSON.parse(row.data) : (row.data || {});
              const campObj = {
                ...cData,
                id: row.id,
                name: row.name || cData.name || "Sem Nome",
                masterId: row.master_id || cData.masterId,
                masterEmail: (row.master_email || cData.masterEmail || "").trim().toLowerCase(),
                inviteCode: row.invite_code || cData.inviteCode || "",
                playerEmails: cData.playerEmails || row.player_emails || []
              };
              campMap.set(row.id, campObj);
            });
          }
        }
      } catch (err) {}
    }

    let campaigns = Array.from(campMap.values());
    if (cleanMaster) {
      campaigns = campaigns.filter(c => (c.masterEmail || "").toLowerCase() === cleanMaster);
    } else if (cleanPlayer) {
      campaigns = campaigns.filter(c => {
        const emails = Array.isArray(c.playerEmails) ? c.playerEmails.map((e: string) => (e || "").toLowerCase()) : [];
        return emails.includes(cleanPlayer);
      });
    }

    return res.json({ success: true, count: campaigns.length, campaigns });
  });

  // 2. Find campaign by invite code
  app.get("/api/campaigns/invite/:inviteCode", async (req, res) => {
    const inviteCode = (req.params.inviteCode || "").trim().toUpperCase();
    if (!inviteCode) return res.status(400).json({ error: "inviteCode é obrigatório." });

    // Check disk store first
    try {
      const store = getCampaignsStore();
      for (const camp of Object.values(store)) {
        if (camp && String(camp.inviteCode || camp.invite_code || "").trim().toUpperCase() === inviteCode) {
          return res.json({ success: true, campaign: camp });
        }
      }
    } catch (e) {}

    // Check Supabase if reachable
    if (await isSupabaseReachable()) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const campRes = await fetch(`${targetSupabase}/rest/v1/campaigns?invite_code=eq.${encodeURIComponent(inviteCode)}&select=*`, {
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            Accept: "application/json"
          },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (campRes.ok) {
          const rows = await campRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const row = rows[0];
            const cData = typeof row.data === "string" ? JSON.parse(row.data) : (row.data || {});
            const campObj = {
              ...cData,
              id: row.id,
              name: row.name || cData.name || "Sem Nome",
              masterId: row.master_id || cData.masterId,
              masterEmail: (row.master_email || cData.masterEmail || "").trim().toLowerCase(),
              inviteCode: row.invite_code || cData.inviteCode || "",
              playerEmails: cData.playerEmails || row.player_emails || []
            };
            // Cache in disk store
            try {
              const store = getCampaignsStore();
              store[campObj.id] = campObj;
              saveCampaignsStore(store);
            } catch (e) {}
            return res.json({ success: true, campaign: campObj });
          }
        }
      } catch (err) {}
    }

    return res.status(404).json({ error: "Campanha não encontrada para o código informado." });
  });

  // 3. Create or update campaign
  app.post("/api/campaigns", async (req, res) => {
    const campaign = req.body;
    if (!campaign || !campaign.id) {
      return res.status(400).json({ error: "campaign com ID é obrigatório." });
    }

    const cleanMaster = (campaign.masterEmail || "").trim().toLowerCase();
    const cleanCamp = {
      ...campaign,
      masterEmail: cleanMaster,
      playerEmails: Array.isArray(campaign.playerEmails) ? campaign.playerEmails.map((e: string) => (e || "").trim().toLowerCase()) : []
    };

    // Save to disk store
    try {
      const store = getCampaignsStore();
      store[cleanCamp.id] = cleanCamp;
      saveCampaignsStore(store);
    } catch (e) {
      console.error("[API save campaign] Store error:", e);
    }

    // Upsert to Supabase if online
    if (await isSupabaseReachable()) {
      try {
        await fetch(`${targetSupabase}/rest/v1/campaigns`, {
          method: "POST",
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates"
          },
          body: JSON.stringify({
            id: cleanCamp.id,
            master_id: cleanCamp.masterId || cleanMaster,
            master_email: cleanMaster,
            name: cleanCamp.name || "Sem Nome",
            invite_code: cleanCamp.inviteCode || "",
            data: cleanCamp,
            updated_at: new Date().toISOString()
          })
        });
      } catch (err) {}
    }

    return res.json({ success: true, campaign: cleanCamp });
  });

  // 4. Join campaign
  app.post("/api/campaigns/:campaignId/join", async (req, res) => {
    const { campaignId } = req.params;
    const { playerEmail } = req.body;
    const cleanEmail = (playerEmail || "").trim().toLowerCase();

    if (!campaignId) return res.status(400).json({ error: "campaignId é obrigatório." });

    const store = getCampaignsStore();
    const camp = store[campaignId] || { id: campaignId, name: "Campanha", playerEmails: [] };
    let playerEmails: string[] = Array.isArray(camp.playerEmails) ? camp.playerEmails : [];
    if (cleanEmail && !playerEmails.includes(cleanEmail)) {
      playerEmails.push(cleanEmail);
    }
    camp.playerEmails = playerEmails;
    store[campaignId] = camp;
    saveCampaignsStore(store);

    if (await isSupabaseReachable()) {
      try {
        await fetch(`${targetSupabase}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
          method: "PATCH",
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            data: camp,
            updated_at: new Date().toISOString()
          })
        });
      } catch (e) {}
    }

    return res.json({ success: true, campaign: camp });
  });

  // 5. Leave campaign
  app.post("/api/campaigns/:campaignId/leave", async (req, res) => {
    const { campaignId } = req.params;
    const { playerEmail } = req.body;
    const cleanEmail = (playerEmail || "").trim().toLowerCase();

    if (!campaignId) return res.status(400).json({ error: "campaignId é obrigatório." });

    const store = getCampaignsStore();
    const camp = store[campaignId];
    if (camp && Array.isArray(camp.playerEmails)) {
      camp.playerEmails = camp.playerEmails.filter((e: string) => (e || "").toLowerCase() !== cleanEmail);
      store[campaignId] = camp;
      saveCampaignsStore(store);
    }

    return res.json({ success: true });
  });

  // 6. Delete campaign
  app.delete("/api/campaigns/:campaignId", async (req, res) => {
    const { campaignId } = req.params;
    if (!campaignId) return res.status(400).json({ error: "campaignId é obrigatório." });

    try {
      const store = getCampaignsStore();
      delete store[campaignId];
      saveCampaignsStore(store);
    } catch (e) {}

    try {
      const charStore = getCampaignCharactersStore();
      delete charStore[campaignId];
      saveCampaignCharactersStore(charStore);
    } catch (e) {}

    if (await isSupabaseReachable()) {
      try {
        await fetch(`${targetSupabase}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
          method: "DELETE",
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`
          }
        });
      } catch (e) {}
    }

    return res.json({ success: true });
  });

  // Dedicated API: Get all characters linked to a campaign (bypasses RLS using service role and local store)
  app.get("/api/campaigns/:campaignId/characters", async (req, res) => {
    const { campaignId } = req.params;
    if (!campaignId) return res.status(400).json({ error: "campaignId é obrigatório" });

    const charMap = new Map<string, any>();

    // 1. ALWAYS load currently persisted characters from disk store first!
    try {
      const store = getCampaignCharactersStore();
      const storedList = store[campaignId] || [];
      storedList.forEach((c: any) => {
        if (c && c.id) {
          charMap.set(c.id, { ...c, campaignId });
        }
      });
    } catch (e) {
      console.error("[Characters API] Error loading disk store:", e);
    }

    // 2. Also check if campaign store on disk has embedded playerCharacters
    try {
      const campStore = getCampaignsStore();
      const camp = campStore[campaignId];
      if (camp) {
        const pcs = camp.playerCharacters || camp.data?.playerCharacters || [];
        if (Array.isArray(pcs)) {
          pcs.forEach((pc: any) => {
            if (pc && pc.id && !charMap.has(pc.id)) {
              charMap.set(pc.id, { ...pc, campaignId });
            }
          });
        }
      }
    } catch (e) {}

    // 3. If Supabase is reachable, merge Supabase characters without wiping local disk store
    if (await isSupabaseReachable()) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        // A. Fetch characters where campaign_id = campaignId
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

        // B. Fetch campaign row in Supabase and check if playerCharacters has any character
        const campRes = await fetch(`${targetSupabase}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}&select=*`, {
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            Accept: "application/json"
          },
          signal: controller.signal
        });

        if (campRes.ok) {
          const cRows = await campRes.json();
          if (Array.isArray(cRows) && cRows.length > 0) {
            const cRow = cRows[0];
            const cData = typeof cRow.data === "string" ? JSON.parse(cRow.data) : (cRow.data || {});
            const pcs = cData.playerCharacters || [];
            if (Array.isArray(pcs)) {
              pcs.forEach((pc: any) => {
                if (pc && pc.id && !charMap.has(pc.id)) {
                  charMap.set(pc.id, { ...pc, campaignId });
                }
              });
            }
          }
        }

        clearTimeout(timeout);
      } catch (err) {
        console.warn("[Characters API] Supabase fetch handled gracefully:", err);
      }
    }

    const characters = Array.from(charMap.values());
    
    // Update local disk cache with freshest merged state (only if non-empty or if disk store already has an entry)
    try {
      const store = getCampaignCharactersStore();
      if (characters.length > 0 || store[campaignId]) {
        store[campaignId] = characters;
        saveCampaignCharactersStore(store);
      }
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

    // 2. Also update in campaigns_store if campaign exists
    try {
      const campStore = getCampaignsStore();
      const camp = campStore[campaignId];
      if (camp) {
        let playerCharacters = camp.playerCharacters || [];
        if (!Array.isArray(playerCharacters)) playerCharacters = [];
        playerCharacters = [...playerCharacters.filter((c: any) => c.id !== cleanChar.id), cleanChar];
        camp.playerCharacters = playerCharacters;
        campStore[campaignId] = camp;
        saveCampaignsStore(campStore);
      }
    } catch (e) {}

    // 3. Persist to Supabase using SERVICE_ROLE_KEY only if reachable
    if (await isSupabaseReachable()) {
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
      } catch {
        isSupabaseOnline = false;
      }
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

    // 1. Remove from characters disk store
    try {
      const store = getCampaignCharactersStore();
      if (store[campaignId]) {
        store[campaignId] = store[campaignId].filter((c: any) => c.id !== characterId);
        saveCampaignCharactersStore(store);
      }
    } catch (e) {}

    // 2. Remove from campaign disk store
    try {
      const campStore = getCampaignsStore();
      const camp = campStore[campaignId];
      if (camp && Array.isArray(camp.playerCharacters)) {
        camp.playerCharacters = camp.playerCharacters.filter((c: any) => c.id !== characterId);
        campStore[campaignId] = camp;
        saveCampaignsStore(campStore);
      }
    } catch (e) {}

    // 3. Remove campaign_id in Supabase only if reachable
    if (await isSupabaseReachable()) {
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

        // Update campaign's playerCharacters array in Supabase
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
              await fetch(`${targetSupabase}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
                method: "PATCH",
                headers: {
                  apikey: SERVICE_ROLE_KEY,
                  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  data: { ...campData, playerCharacters },
                  updated_at: new Date().toISOString()
                })
              });
            }
          }
        }
      } catch (e) {}
    }

    return res.json({ success: true });
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

  // Explicitly serve /public directory with caching & CORS headers so all monster and token images load reliably
  const publicPath = path.join(process.cwd(), 'public');
  app.use(express.static(publicPath, {
    maxAge: '1h',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }));

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

  // Handle WebSocket upgrades for VTT instant sync and Supabase Realtime
  server.on('upgrade', (req, socket, head) => {
    const url = req.url || '';
    console.log(`[DEBUG][VTT] Upgrade request for ${url}`);

    // VTT High-Performance Duplex WebSocket Connection
    if (url.startsWith('/api/vtt/ws') || url.startsWith('/vtt-ws')) {
      console.log(`[DEBUG][VTT] Upgrade proceeding for ${url}`);
      vttWss.handleUpgrade(req, socket, head, (ws) => {
        console.log(`[DEBUG][VTT] WebSocket handshake success for ${url}`);
        vttWss.emit('connection', ws, req);
      });
      return;
    }

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
