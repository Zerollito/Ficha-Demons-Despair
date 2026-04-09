import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import cookieSession from "cookie-session";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || "rpg-sheet-secret";

console.log("Environment check:", {
  hasClientId: !!GOOGLE_CLIENT_ID,
  clientIdPrefix: GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.substring(0, 10) + "..." : "none",
  hasClientSecret: !!GOOGLE_CLIENT_SECRET,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(
    cookieSession({
      name: "session",
      keys: [SESSION_SECRET],
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: true,
      sameSite: "none",
    })
  );

  const requestLog: string[] = [];
  app.use((req, res, next) => {
    const logEntry = `${new Date().toISOString()} - ${req.method} ${req.url} (Path: ${req.path})`;
    console.log(logEntry);
    if (req.url.includes('/api/')) {
      requestLog.push(logEntry);
      if (requestLog.length > 50) requestLog.shift();
    }
    next();
  });

  const getOAuthClient = (req: express.Request, originOverride?: string) => {
    let origin = "";

    if (originOverride) {
      origin = originOverride.replace(/\/$/, "");
    } else if (process.env.APP_URL) {
      origin = process.env.APP_URL.replace(/\/$/, "");
    } else {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers["host"];
      origin = `${protocol}://${host}`;
    }

    const redirectUri = `${origin}/api/auth/google/callback`;
    
    return new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );
  };

  const apiRouter = express.Router();

  apiRouter.get("/debug/requests", (req, res) => {
    res.json({
      logs: requestLog,
      env: {
        hasClientId: !!GOOGLE_CLIENT_ID,
        nodeEnv: process.env.NODE_ENV,
        appUrl: process.env.APP_URL,
        headers: req.headers
      }
    });
  });

  apiRouter.get("/ping", (req, res) => {
    res.json({ pong: true, time: new Date().toISOString(), headers: req.headers });
  });

  apiRouter.use(express.json({ limit: '10mb' }));
  
  // Auth Routes
  apiRouter.get("/auth/google/url", (req, res) => {
    try {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: "Credenciais do Google não configuradas." });
      }
      
      const originOverride = req.query.origin as string;
      const oauth2Client = getOAuthClient(req, originOverride);
      
      const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/drive.file"],
        prompt: "consent",
      });
      res.json({ url });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Erro ao gerar URL." });
    }
  });

  apiRouter.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");
    try {
      const oauth2Client = getOAuthClient(req);
      const { tokens } = await oauth2Client.getToken(code as string);
      req.session!.tokens = tokens;
      res.send(`<html><body><script>if(window.opener){window.opener.postMessage({type:'OAUTH_AUTH_SUCCESS'},'*');window.close();}else{window.location.href='/';}</script></body></html>`);
    } catch (error) {
      res.status(500).send("Authentication failed");
    }
  });

  apiRouter.get("/auth/google/status", (req, res) => {
    res.json({ connected: !!req.session?.tokens });
  });

  apiRouter.post("/auth/google/logout", (req, res) => {
    req.session = null;
    res.json({ success: true });
  });

  // Drive Routes
  apiRouter.post("/drive/save", async (req, res) => {
    if (!req.session?.tokens) return res.status(401).json({ error: "Not authenticated" });
    try {
      const oauth2Client = getOAuthClient(req);
      oauth2Client.setCredentials(req.session.tokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const { data, filename } = req.body;
      const listRes = await drive.files.list({ q: `name = '${filename}' and trashed = false`, fields: "files(id)" });
      const fileId = listRes.data.files?.[0]?.id;
      if (fileId) {
        await drive.files.update({ fileId, media: { mimeType: "application/json", body: JSON.stringify(data) } });
      } else {
        await drive.files.create({ requestBody: { name: filename, mimeType: "application/json" }, media: { mimeType: "application/json", body: JSON.stringify(data) } });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save" });
    }
  });

  apiRouter.get("/drive/load", async (req, res) => {
    if (!req.session?.tokens) return res.status(401).json({ error: "Not authenticated" });
    try {
      const oauth2Client = getOAuthClient(req);
      oauth2Client.setCredentials(req.session.tokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const filename = req.query.filename as string;
      const listRes = await drive.files.list({ q: `name = '${filename}' and trashed = false`, fields: "files(id)" });
      const fileId = listRes.data.files?.[0]?.id;
      if (!fileId) return res.status(404).json({ error: "File not found" });
      const fileRes = await drive.files.get({ fileId, alt: "media" });
      res.json(fileRes.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to load" });
    }
  });

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Catch-all for undefined API routes
  apiRouter.all("*", (req, res) => {
    res.status(404).json({ error: "Rota de API não encontrada", method: req.method, url: req.url });
  });

  // Mount the API router to handle /api, //api, etc.
  app.use((req, res, next) => {
    if (req.url.match(/^\/+api\//)) {
      // Normalize URL to single slash for the router
      req.url = req.url.replace(/^\/+api/, '/api');
    }
    next();
  });
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
    
    // Serve static files first
    app.use(express.static(distPath));
    
    // SPA fallback for all other routes
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
