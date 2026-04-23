import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import { google } from "googleapis";
import session from "express-session";
import cookieParser from "cookie-parser";

// Suporte a tipos de Sessão customizados
declare module 'express-session' {
  interface SessionData {
    tokens: any;
    accessToken: string;
    lastRedirectUri: string;
  }
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// Helper to get OAuth2 client
function createOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirectUri || GOOGLE_REDIRECT_URI
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Essential for cookies behind proxies
  app.set("trust proxy", 1);

  // 1. Logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // 2. Standard Midlewares
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'rpg-secret-key',
    resave: true, // Necessário para salvar o accessToken na sessão
    saveUninitialized: false,
    proxy: true,
    name: 'rpg_session',
    cookie: {
      secure: true,
      sameSite: 'none', // OBRIGATÓRIO PARA O PREVIEW DO AI STUDIO (IFRAME)
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    }
  }));

  // Memória para recuperação de sessão via Token (Drible de Cookies)
  const tokenSessionMap = new Map<string, any>();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // 3. API Router
  const apiRouter = express.Router();

  // Middleware de Autenticação Robusta
  apiRouter.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    // SUPORTE A TOKEN EM LOCALSTORAGE (Caso os cookies falhem no iframe/celular)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const clientToken = authHeader.split(' ')[1];
      
      // Se a sessão está vazia no servidor, mas o cliente mandou um Token que conhecemos:
      if (!(req.session as any).tokens && tokenSessionMap.has(clientToken)) {
          console.log("Sessão RESGATADA via Bearer Token!");
          const data = tokenSessionMap.get(clientToken);
          (req.session as any).tokens = data.tokens;
          (req.session as any).accessToken = clientToken;
      }
    }
    
    // Garante que o Cloudflare considere o Cookie e o Token para o Cache
    res.setHeader('Vary', 'Cookie, Authorization');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('CDN-Cache-Control', 'no-store'); // Instrução direta para Cloudflare
    next();
  });

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  apiRouter.get("/debug", (req, res) => {
    res.json({
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      protocol: req.protocol,
      forwardedProto: req.headers['x-forwarded-proto'],
      forwardedHost: req.headers['x-forwarded-host'],
      ip: req.ip,
      ips: req.ips,
      trustProxy: app.get('trust proxy'),
      origin: req.get('origin') || 'none'
    });
  });

  apiRouter.post("/auth/reconnect", async (req, res) => {
    const { tokens, accessToken } = req.body;
    if (!tokens) return res.status(400).json({ error: "Missing tokens" });
    
    (req.session as any).tokens = tokens;
    (req.session as any).accessToken = accessToken;
    
    // Atualiza o mapa global para garantir que o middleware recognize
    if (accessToken) {
        tokenSessionMap.set(accessToken, { tokens });
    }

    req.session.save(() => {
        res.json({ status: "Session restored" });
    });
  });

  // Unificação dos escopos para garantir permissões consistentes
  const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  // ROTA DE REDIRECIONAMENTO DIRETO (Evita bloqueios de popup e página em branco)
  apiRouter.get("/auth/google/url/direct", (req, res) => {
    try {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
          throw new Error("As credenciais do Google Drive (GOOGLE_CLIENT_ID/SECRET) não foram configuradas no servidor.");
      }

      const origin = req.query.origin as string || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.get('host')}`;
      const redirectUri = `${origin.replace(/\/$/, '')}/api/auth/google/callback`;
      
      const client = createOAuthClient(redirectUri);
      const state = Buffer.from(JSON.stringify({ r: redirectUri })).toString('base64');
      
      const url = client.generateAuthUrl({
        access_type: 'offline',
        scope: GOOGLE_SCOPES,
        prompt: 'consent',
        state: state
      });
      
      // Enviamos uma página HTML de transição em vez de um redirecionamento 302 puro.
      // Isso é muito mais confiável em popups e ambientes com proxy/Cloudflare.
      res.setHeader('Content-Type', 'text/html');
      res.send(`
        <html>
          <head>
            <title>Iniciando Google Drive...</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { background: #09090b; color: #f4f4f5; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .loader-container { text-align: center; }
              .loader { border: 4px solid #27272a; border-top: 4px solid #10b981; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              h3 { margin-bottom: 8px; color: #f4f4f5; }
              p { color: #a1a1aa; font-size: 14px; }
              .btn { display: none; margin-top: 20px; background: #10b981; color: #000; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="loader-container">
              <div class="loader"></div>
              <h3>Vinculando conta...</h3>
              <p>Você será redirecionado para o Google em um instante.</p>
              <a href="${url}" id="manualLink" class="btn">Clique aqui se não for redirecionado</a>
            </div>
            <script>
              // Redireciona via JS
              window.location.href = "${url}";
              // Mostra o botão manual se demorar mais que 3 segundos
              setTimeout(() => {
                document.getElementById('manualLink').style.display = 'inline-block';
              }, 3000);
            </script>
          </body>
        </html>
      `);
    } catch (e: any) {
      console.error("Direct URL Generation Error:", e);
      res.setHeader('Content-Type', 'text/html');
      res.status(500).send(`
        <body style="background: #09090b; color: #f43f5e; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; margin: 0; padding: 20px; text-align: center;">
          <div>
            <h2 style="margin-bottom: 15px;">Falha ao Iniciar Login</h2>
            <p style="color: #a1a1aa; margin-bottom: 25px;">${e.message}</p>
            <button onclick="window.close()" style="background: #27272a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Fechar Janela</button>
          </div>
        </body>
      `);
    }
  });

  apiRouter.get("/auth/google/url", (req, res) => {
    try {
      if (!GOOGLE_CLIENT_ID) throw new Error("Configuração ausente.");
      
      const origin = req.query.origin as string;
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const currentOrigin = origin || `${protocol}://${host}`;
      const redirectUri = `${currentOrigin.replace(/\/$/, '')}/api/auth/google/callback`;

      const client = createOAuthClient(redirectUri);
      
      // CODIFICA O REDIRECT_URI NO STATE (À prova de falhas de sessão/cookies)
      const state = Buffer.from(JSON.stringify({ r: redirectUri })).toString('base64');

      const url = client.generateAuthUrl({
        access_type: 'offline',
        scope: GOOGLE_SCOPES,
        prompt: 'consent',
        state: state
      });
      
      console.log(`OAuth URL Gerada com State: ${url}`);
      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/auth/google/profile", async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) return res.status(401).json({ error: "Unauthorized" });
    try {
      const client = createOAuthClient();
      client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const info = await oauth2.userinfo.get();
      res.json(info.data);
    } catch (e: any) {
      console.error("Erro ao buscar perfil:", e);
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/auth/google/callback", async (req, res) => {
    const { code, state } = req.query;
    try {
      // 1. Tenta recuperar o URI real do parâmetro STATE (mais confiável em ambientes com proxy/Cloudflare)
      let appOrigin = null;
      let stateRedirectUri = null;
      if (state) {
        try {
            const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
            stateRedirectUri = decoded.r;
            if (stateRedirectUri) {
                const url = new URL(stateRedirectUri);
                appOrigin = url.origin;
            }
        } catch(e) { /* ignore */ }
      }

      // 2. Fallbacks
      const savedRedirectUri = (req.session as any).lastRedirectUri;
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const fallbackOrigin = `${protocol}://${host}`;
      appOrigin = appOrigin || fallbackOrigin;
      const fallbackRedirectUri = `${appOrigin.replace(/\/$/, '')}/api/auth/google/callback`;

      const redirectUri = stateRedirectUri || savedRedirectUri || fallbackRedirectUri;

      console.log(`OAuth Callback - Usando RedirectUri FINAL: ${redirectUri}`);
      const client = createOAuthClient(redirectUri);
      const { tokens } = await client.getToken(code as string);
      
      // GERA UM TOKEN DE ACESSO PARA O FRONT-END (Bypass de Cookie)
      const accessToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      (req.session as any).accessToken = accessToken;
      (req.session as any).tokens = tokens;

      // REGISTRA NO MAPA GLOBAL PARA RESGATE (Caso o cookie de sessão suma no iframe)
      tokenSessionMap.set(accessToken, { tokens });

      req.session.save(() => {
        res.setHeader('Content-Type', 'text/html');
        res.send(`
          <html>
            <head>
              <title>Conectado!</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { background: #09090b; color: #f4f4f5; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
                .card { background: #18181b; padding: 32px; border-radius: 16px; border: 1px solid #27272a; max-width: 400px; width: 100%; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4); }
                h2 { color: #10b981; margin: 0 0 16px 0; }
                .btn { background: #10b981; color: #000; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>✓ Conectado!</h2>
                <p>O Google Drive foi vinculado com sucesso.</p>
                <a href="/" class="btn" id="backBtn">Voltar ao RPG</a>
                
                <div id="manualLink" style="display: none; margin-top: 20px; border-top: 1px solid #27272a; pt: 20px;">
                    <p style="font-size: 11px; color: #a1a1aa;">Não sincronizou sozinho? Clique abaixo:</p>
                    <a href="/?google_auth_token=${accessToken}" class="btn" style="background: #3b82f6;">Sincronizar Manualmente</a>
                </div>
              </div>
              <script>
                // ENCODING SEGURO
                const b64Tokens = '${Buffer.from(JSON.stringify(tokens)).toString('base64')}';
                const tokens = JSON.parse(atob(b64Tokens));
                const accessToken = '${accessToken}';
                
                // 1. Grava no local (para garantir se for mesmo domínio)
                localStorage.setItem('google_drive_access_token', accessToken);
                localStorage.setItem('google_drive_tokens', JSON.stringify(tokens));
                localStorage.setItem('google_drive_connected_at', Date.now().toString());
                localStorage.setItem('google_drive_login_success', Date.now().toString());
                
                // 2. Loop de Mensagens (Garante entrega mesmo se o receptor demorar para carregar)
                let attempts = 0;
                const messageInterval = setInterval(() => {
                    if (window.opener) {
                        window.opener.postMessage({ 
                            type: 'OAUTH_AUTH_SUCCESS', 
                            token: accessToken,
                            tokens: tokens 
                        }, '*');
                        console.log("Tentativa de envio de mensagem:", attempts);
                    }
                    attempts++;
                    // Se passar de 5 tentativas (2.5s), mostra o link de resgate manual
                    if (attempts === 5) {
                        document.getElementById('manualLink').style.display = 'block';
                    }
                    if (attempts > 30) { // Para após 15 segundos
                        clearInterval(messageInterval);
                    }
                }, 500);

                // 3. Ouve confirmação do App pai para fechar antes
                window.addEventListener('message', (event) => {
                    if (event.data === 'AUTH_ACKNOWLEDGED') {
                        clearInterval(messageInterval);
                        document.body.innerHTML = '<h2>✓ Sincronizado!</h2><p>Voltando ao RPG...</p>';
                        setTimeout(() => window.close(), 800);
                    }
                });
              </script>
            </body>
          </html>
        `);
      });
    } catch (e: any) {
      console.error("Erro no callback OAuth:", e);
      res.setHeader('Content-Type', 'text/html');
      res.status(500).send(`
        <html>
          <body style="background: #09090b; color: #f43f5e; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; padding: 20px; text-align: center;">
            <h2 style="margin-bottom: 10px;">Falha na Autenticação</h2>
            <p style="color: #a1a1aa; max-width: 500px; margin-bottom: 20px;">
              O Google não conseguiu completar o login. Isso geralmente acontece se o link de retorno não estiver cadastrado no Console do Google Cloud.
            </p>
            <div style="background: #18181b; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; text-align: left; border: 1px solid #27272a; width: 100%; max-width: 600px; overflow-x: auto;">
              <strong>Erro:</strong> ${e.message || "Erro desconhecido"}<br><br>
              <strong>Redirect URI tentado:</strong> <span style="color: #fbbf24;">${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}/api/auth/google/callback</span><br><br>
              <strong>Dica:</strong> Copie o link amarelo acima e cole no seu Google Console em "URIs de redirecionamento autorizados".
            </div>
            <button onclick="window.close()" style="margin-top: 25px; background: #27272a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Fechar Janela</button>
          </body>
        </html>
      `);
    }
  });

  apiRouter.get("/drive/status", (req, res) => {
    res.json({ connected: !!(req.session as any).tokens });
  });

  apiRouter.post("/drive/sync", async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) return res.status(401).json({ error: "Unauthorized" });
    try {
      const client = createOAuthClient();
      client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: client });
      
      const data = req.body.data;
      if (!data) return res.status(400).json({ error: "No data provided" });

      console.log("Iniciando Sincronização no Google Drive...");
      
      // Busca específica pelo nome do arquivo
      const list = await drive.files.list({ 
        q: "name = 'rpg_demons_despair.json' and trashed = false",
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      const existing = list.data.files?.[0];
      
      if (existing) {
        console.log(`Atualizando arquivo existente: ${existing.id}`);
        await drive.files.update({
          fileId: existing.id!,
          media: { mimeType: 'application/json', body: JSON.stringify(data) }
        });
        res.json({ status: 'success', fileId: existing.id });
      } else {
        console.log("Criando novo arquivo no Google Drive...");
        const created = await drive.files.create({
          requestBody: { 
            name: 'rpg_demons_despair.json', 
            mimeType: 'application/json',
            description: 'Backup da ficha de RPG Demons Despair'
          },
          media: { mimeType: 'application/json', body: JSON.stringify(data) }
        });
        res.json({ status: 'success', fileId: created.data.id });
      }
    } catch (e: any) {
      console.error("ERRO CRÍTICO NA SINCRONIZAÇÃO:", e);
      res.status(500).json({ error: e.message || "Sync failed" });
    }
  });

  apiRouter.get("/drive/fetch", async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) return res.status(401).json({ error: "Unauthorized" });
    try {
      const client = createOAuthClient();
      client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: client });
      
      console.log("Buscando arquivo no Google Drive...");
      const list = await drive.files.list({ 
        q: "name = 'rpg_demons_despair.json' and trashed = false",
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      const file = list.data.files?.[0];
      if (!file) {
        console.log("Arquivo não encontrado.");
        return res.json({ data: null });
      }
      
      console.log(`Baixando conteúdo do arquivo: ${file.id}`);
      const content = await drive.files.get({ 
        fileId: file.id!, 
        alt: 'media' 
      });
      
      // O SDK às vezes retorna o JSON direto em content.data se for JSON
      res.json({ data: content.data });
    } catch (e: any) {
      console.error("ERRO CRÍTICO NA BUSCA:", e);
      res.status(500).json({ error: e.message || "Fetch failed" });
    }
  });

  apiRouter.post("/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  apiRouter.all("*", (req, res) => {
    res.status(404).json({ error: "API Route Not Found", url: req.url });
  });

  // Mount API
  app.use("/api", apiRouter);

  // 4. Production / Static
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
