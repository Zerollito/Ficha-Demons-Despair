import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import cors from "cors";

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
  APP_URL: process.env.APP_URL
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS for all origins (important for APKs and proxies)
  app.use(cors({
    origin: (origin, callback) => {
      // Allow all origins to fix APK/Worker issues
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

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

  // 1. Logging Middleware (Must be first)
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
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

  // 2. API Router Definition
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Auth & Drive Routes inside apiRouter
  apiRouter.get("/auth/google/url", (req, res) => {
    try {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: "Credenciais do Google ausentes no servidor." });
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
      res.status(500).json({ error: String(err) });
    }
  });

  apiRouter.get("/auth/google/callback", async (req, res) => {
    const { code, error: queryError } = req.query;
    if (queryError) {
      console.error("Google Auth Error Query:", queryError);
      return res.status(400).send(`Auth failed: ${queryError}`);
    }
    if (!code) return res.status(400).send("No code provided by Google");
    
    try {
      const oauth2Client = getOAuthClient(req);
      console.log("Exchanging code for tokens. Redirect URI used:", oauth2Client.redirectUri);
      
      const { tokens } = await oauth2Client.getToken(code as string);
      req.session!.tokens = tokens;
      
      res.send(`<html><body><script>if(window.opener){window.opener.postMessage({type:'OAUTH_AUTH_SUCCESS'},'*');window.close();}else{window.location.href='/';}</script></body></html>`);
    } catch (error: any) {
      console.error("OAuth Token Exchange Error:", error);
      const errorMsg = error.response?.data?.error_description || error.message || String(error);
      res.status(500).send(`Auth failed: ${errorMsg}`);
    }
  });

  apiRouter.get("/auth/google/status", (req, res) => {
    res.json({ connected: !!req.session?.tokens });
  });

  apiRouter.post("/auth/google/logout", (req, res) => {
    req.session = null;
    res.json({ success: true });
  });

  apiRouter.post("/drive/save", async (req, res) => {
    if (!req.session?.tokens) return res.status(401).json({ error: "Unauthorized" });
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
      res.status(500).json({ error: "Save failed" });
    }
  });

  apiRouter.get("/drive/load", async (req, res) => {
    if (!req.session?.tokens) return res.status(401).json({ error: "Unauthorized" });
    try {
      const oauth2Client = getOAuthClient(req);
      oauth2Client.setCredentials(req.session.tokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const filename = req.query.filename as string;
      const listRes = await drive.files.list({ q: `name = '${filename}' and trashed = false`, fields: "files(id)" });
      const fileId = listRes.data.files?.[0]?.id;
      if (!fileId) return res.status(404).json({ error: "Not found" });
      const fileRes = await drive.files.get({ fileId, alt: "media" });
      res.json(fileRes.data);
    } catch (error) {
      res.status(500).json({ error: "Load failed" });
    }
  });

  apiRouter.all("*", (req, res) => {
    res.status(404).json({ error: "API Route Not Found", method: req.method, url: req.url });
  });

  // 3. Mount API Router (Handle both /api and //api and any number of slashes)
  app.use((req, res, next) => {
    if (req.url.match(/^\/+api\//)) {
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
