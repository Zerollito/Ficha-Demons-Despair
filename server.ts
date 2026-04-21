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
const APP_URL = process.env.APP_URL || "";

// Helper to get OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Requisito para cookies seguros em proxies (Cloudflare/Run.app)
  app.set("trust proxy", 1);

  // 1. Standard middlewares (Cookie e Session precisam vir antes das rotas que os usam)
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

  app.use(cors({
    origin: true,
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));

  // 2. Logging Middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // 3. Mount API Router
  const apiRouter = express.Router();
  
  apiRouter.use((req, res, next) => {
    // Força JSON e desativa cache agressivamente (anti-PWA/anti-Cloudflare)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // --- Google OAuth Routes ---
  apiRouter.get("/auth/google/url", (req, res) => {
    try {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        console.error("ERRO: GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados nos Secrets.");
        return res.status(500).json({ error: "Configuração do Google Drive ausente no servidor." });
      }

      // IMPORTANTE: Tenta usar a origem enviada pelo cliente (Cloudflare, APK, etc)
      // Se não houver, usa o GOOGLE_REDIRECT_URI fixado nos Secrets.
      const clientOrigin = req.query.origin as string;
      const redirectUri = clientOrigin 
        ? `${clientOrigin}/api/auth/google/callback` 
        : GOOGLE_REDIRECT_URI;

      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ];

      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      });

      res.json({ url });
    } catch (error) {
      console.error("Erro ao gerar URL de autenticação:", error);
      res.status(500).json({ error: "Erro interno ao gerar URL de login." });
    }
  });

  apiRouter.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    try {
      // Reconstrói o URI baseado no host da requisição atual para bater com o registrado no Google
      // Usa X-Forwarded-Proto se disponível (Cloudflare/Run.app)
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const currentOrigin = `${protocol}://${host}`;
      const redirectUri = `${currentOrigin}/api/auth/google/callback`;

      console.log(`OAuth Callback detectado. Origin: ${currentOrigin} | RedirectUri: ${redirectUri}`);

      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code as string);
      (req.session as any).tokens = tokens;
      
      // Salva a sessão explicitamente antes de responder
      req.session.save((err) => {
        if (err) {
          console.error("Erro ao salvar sessão:", err);
          return res.status(500).send("Erro interno ao salvar login");
        }

        res.send(`
          <html>
            <body>
              <script>
                // Tenta avisar via postMessage
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                }
                
                // Tenta avisar via localStorage (fallback robusto para WebViews)
                try {
                  localStorage.setItem('google_drive_login_success', Date.now().toString());
                } catch(e) {
                  console.error("Erro ao salvar no localStorage", e);
                }

                // Pequeno delay para garantir que as mensagens/storage sejam processados
                setTimeout(() => {
                  if (window.opener) {
                    window.close();
                  } else {
                    window.location.href = '/';
                  }
                }, 500);
              </script>
              <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h2 style="color: #10b981;">Autenticação Concluída!</h2>
                <p>Você já pode fechar esta janela caso ela não feche sozinha.</p>
              </div>
            </body>
          </html>
        `);
      });
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Falha na autenticação com o Google. Verifique os logs do servidor.");
    }
  });

  apiRouter.get("/drive/status", (req, res) => {
    const tokens = (req.session as any).tokens;
    res.json({ connected: !!tokens });
  });

  apiRouter.post("/drive/sync", async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) {
      return res.status(401).json({ error: "Not connected to Google Drive" });
    }

    const { data } = req.body; // Expecting the AppState
    
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Find existing file
      const searchResponse = await drive.files.list({
        q: "name = 'rpg_system_x_data.json' and trashed = false",
        spaces: 'drive',
        fields: 'files(id, name)'
      });

      const file = searchResponse.data.files?.[0];
      const fileContent = JSON.stringify(data);

      if (file) {
        // Update
        await drive.files.update({
          fileId: file.id!,
          media: {
            mimeType: 'application/json',
            body: fileContent
          }
        });
        res.json({ status: "updated", fileId: file.id });
      } else {
        // Create
        const createResponse = await drive.files.create({
          requestBody: {
            name: 'rpg_system_x_data.json',
            mimeType: 'application/json'
          },
          media: {
            mimeType: 'application/json',
            body: fileContent
          }
        });
        res.json({ status: "created", fileId: createResponse.data.id });
      }
    } catch (error) {
      console.error("Drive Sync Error:", error);
      res.status(500).json({ error: "Failed to sync with Google Drive" });
    }
  });

  apiRouter.get("/drive/fetch", async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) {
      return res.status(401).json({ error: "Not connected to Google Drive" });
    }
    
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const searchResponse = await drive.files.list({
        q: "name = 'rpg_system_x_data.json' and trashed = false",
        spaces: 'drive',
        fields: 'files(id, name)'
      });

      const file = searchResponse.data.files?.[0];
      if (!file) {
        return res.json({ data: null });
      }

      const fileResponse = await drive.files.get({
        fileId: file.id!,
        alt: 'media'
      });

      res.json({ data: fileResponse.data });
    } catch (error) {
      console.error("Drive Fetch Error:", error);
      res.status(500).json({ error: "Failed to fetch from Google Drive" });
    }
  });

  apiRouter.post("/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  apiRouter.all("*", (req, res) => {
    res.status(404).json({ error: "API Route Not Found", method: req.method, url: req.url });
  });

  // 3. Mount API Router
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    
    // Serve static files (but don't fallback to index.html for API paths)
    app.use(express.static(distPath));
    
    // SPA fallback: Serve index.html para qualquer rota que não seja um arquivo estático ou API (já filtrado acima)
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
