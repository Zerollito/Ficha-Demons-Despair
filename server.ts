import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import { google } from "googleapis";
import session from "express-session";
import cookieParser from "cookie-parser";

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
    resave: true,
    saveUninitialized: true,
    proxy: true,
    cookie: {
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000
    }
  }));

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // 3. API Router
  const apiRouter = express.Router();

  // Enforce JSON and No-Cache for ALL API routes
  apiRouter.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
        scope: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email'
        ],
        prompt: 'consent',
        state: state
      });
      
      console.log(`OAuth URL Gerada com State: ${url}`);
      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/auth/google/callback", async (req, res) => {
    const { code, state } = req.query;
    try {
      // 1. Tenta recuperar o URI real do parâmetro STATE (mais confiável)
      let stateRedirectUri = null;
      if (state) {
        try {
            const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
            stateRedirectUri = decoded.r;
        } catch(e) { /* ignore */ }
      }

      // 2. Fallbacks
      const savedRedirectUri = (req.session as any).lastRedirectUri;
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const fallbackOrigin = `${protocol}://${host}`;
      const fallbackRedirectUri = `${fallbackOrigin.replace(/\/$/, '')}/api/auth/google/callback`;

      const redirectUri = stateRedirectUri || savedRedirectUri || fallbackRedirectUri;

      console.log(`OAuth Callback - Usando RedirectUri FINAL: ${redirectUri}`);
      const client = createOAuthClient(redirectUri);
      console.log(`OAuth Callback - Verificando redirecionamento: ${redirectUri}`);
      const { tokens } = await client.getToken(code as string);
      (req.session as any).tokens = tokens;
      
      req.session.save(() => {
        res.setHeader('Content-Type', 'text/html');
        res.send(`
          <html>
            <head>
              <title>Conectado!</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  background: #09090b;
                  color: #f4f4f5;
                  font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  padding: 20px;
                  text-align: center;
                }
                .card {
                  background: #18181b;
                  padding: 32px;
                  border-radius: 16px;
                  border: 1px solid #27272a;
                  max-width: 400px;
                  width: 100%;
                  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
                }
                h2 { color: #10b981; margin: 0 0 16px 0; }
                p { color: #a1a1aa; line-height: 1.5; margin-bottom: 24px; }
                .btn {
                  background: #10b981;
                  color: #000;
                  border: none;
                  padding: 12px 24px;
                  border-radius: 8px;
                  font-weight: 600;
                  cursor: pointer;
                  text-decoration: none;
                  display: inline-block;
                }
                .btn:hover { background: #34d399; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>✓ Sucesso!</h2>
                <p>O Google Drive foi conectado com sucesso à sua ficha.</p>
                <a href="/" class="btn" id="backBtn">Voltar ao App</a>
              </div>
              <script>
                // 1. Notifica via postMessage (para Popups em PC/Mac)
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                }
                
                // 2. Notifica via localStorage (para Mobile/WebViews onde postMessage falha)
                localStorage.setItem('google_drive_login_success', Date.now().toString());
                
                // 3. Tenta fechar automaticamente após um pequeno delay
                setTimeout(() => {
                  try {
                    if (window.opener) {
                      window.close();
                    } else {
                      // Se não for um popup, redireciona em vez de fechar
                      window.location.href = '/';
                    }
                  } catch (e) {
                    console.log("Não foi possível fechar a janela, permanecendo no botão.");
                  }
                }, 2000);
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
      
      const fileId = req.body.fileId;
      const data = req.body.data;

      if (fileId) {
        await drive.files.update({
          fileId,
          media: { mimeType: 'application/json', body: JSON.stringify(data) }
        });
        res.json({ status: 'success' });
      } else {
        const list = await drive.files.list({ q: "name = 'rpg_demons_despair.json' and trashed = false" });
        const existing = list.data.files?.[0];
        
        if (existing) {
          await drive.files.update({
            fileId: existing.id!,
            media: { mimeType: 'application/json', body: JSON.stringify(data) }
          });
          res.json({ status: 'success', fileId: existing.id });
        } else {
          const created = await drive.files.create({
            requestBody: { name: 'rpg_demons_despair.json', mimeType: 'application/json' },
            media: { mimeType: 'application/json', body: JSON.stringify(data) }
          });
          res.json({ status: 'success', fileId: created.data.id });
        }
      }
    } catch (e) {
      res.status(500).json({ error: "Sync failed" });
    }
  });

  apiRouter.get("/drive/fetch", async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) return res.status(401).json({ error: "Unauthorized" });
    try {
      const client = createOAuthClient();
      client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: client });
      const list = await drive.files.list({ q: "name = 'rpg_demons_despair.json' and trashed = false" });
      const file = list.data.files?.[0];
      if (!file) return res.json({ data: null });
      const content = await drive.files.get({ fileId: file.id!, alt: 'media' });
      res.json({ data: content.data });
    } catch (e) {
      res.status(500).json({ error: "Fetch failed" });
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
