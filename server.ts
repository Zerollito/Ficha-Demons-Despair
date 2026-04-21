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

  apiRouter.get("/auth/google/url", (req, res) => {
    try {
      if (!GOOGLE_CLIENT_ID) throw new Error("Configuração ausente.");
      
      const origin = req.query.origin as string;
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      const currentOrigin = origin || `${protocol}://${host}`;
      const redirectUri = `${currentOrigin.replace(/\/$/, '')}/api/auth/google/callback`;

      const client = createOAuthClient(redirectUri);
      const url = client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email'
        ],
        prompt: 'consent'
      });
      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      const currentOrigin = `${protocol}://${host}`;
      const redirectUri = `${currentOrigin}/api/auth/google/callback`;

      const client = createOAuthClient(redirectUri);
      const { tokens } = await client.getToken(code as string);
      (req.session as any).tokens = tokens;
      
      req.session.save(() => {
        res.send(`
          <html>
            <body>
              <script>
                if (window.opener) window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                localStorage.setItem('google_drive_login_success', Date.now());
                setTimeout(() => window.close(), 500);
              </script>
              <h2 style="text-align:center; color: #10b981; margin-top:50px;">Conectado com sucesso!</h2>
            </body>
          </html>
        `);
      });
    } catch (e) {
      res.status(500).send("Erro na autenticação.");
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
