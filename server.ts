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

  const getOAuthClient = (req: express.Request) => {
    // 1. Try APP_URL environment variable (recommended for AI Studio)
    // 2. Try x-forwarded headers
    // 3. Fallback to request headers
    const appUrl = process.env.APP_URL;
    let origin = "";

    if (appUrl) {
      origin = appUrl.replace(/\/$/, "");
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

  // Auth Routes
  app.get("/api/auth/google/url", (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: "Google OAuth credentials not configured" });
    }
    const oauth2Client = getOAuthClient(req);
    
    console.log("Generating Auth URL with redirectUri:", oauth2Client.redirectUri);

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/drive.file"],
      prompt: "consent",
    });
    res.json({ url });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
      const oauth2Client = getOAuthClient(req);
      const { tokens } = await oauth2Client.getToken(code as string);
      req.session!.tokens = tokens;
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Autenticação concluída com sucesso. Esta janela fechará automaticamente.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/auth/google/status", (req, res) => {
    res.json({ connected: !!req.session?.tokens });
  });

  app.post("/api/auth/google/logout", (req, res) => {
    req.session = null;
    res.json({ success: true });
  });

  // Drive Routes
  app.post("/api/drive/save", async (req, res) => {
    if (!req.session?.tokens) return res.status(401).json({ error: "Not authenticated" });

    try {
      const oauth2Client = getOAuthClient(req);
      oauth2Client.setCredentials(req.session.tokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const { data, filename } = req.body;

      // Check if file exists
      const listRes = await drive.files.list({
        q: `name = '${filename}' and trashed = false`,
        fields: "files(id)",
      });

      const fileId = listRes.data.files?.[0]?.id;

      if (fileId) {
        // Update
        await drive.files.update({
          fileId,
          media: {
            mimeType: "application/json",
            body: JSON.stringify(data),
          },
        });
      } else {
        // Create
        await drive.files.create({
          requestBody: {
            name: filename,
            mimeType: "application/json",
          },
          media: {
            mimeType: "application/json",
            body: JSON.stringify(data),
          },
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving to Drive:", error);
      res.status(500).json({ error: "Failed to save to Drive" });
    }
  });

  app.get("/api/drive/load", async (req, res) => {
    if (!req.session?.tokens) return res.status(401).json({ error: "Not authenticated" });

    try {
      const oauth2Client = getOAuthClient(req);
      oauth2Client.setCredentials(req.session.tokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const filename = req.query.filename as string;

      const listRes = await drive.files.list({
        q: `name = '${filename}' and trashed = false`,
        fields: "files(id)",
      });

      const fileId = listRes.data.files?.[0]?.id;

      if (!fileId) return res.status(404).json({ error: "File not found" });

      const fileRes = await drive.files.get({
        fileId,
        alt: "media",
      });

      res.json(fileRes.data);
    } catch (error) {
      console.error("Error loading from Drive:", error);
      res.status(500).json({ error: "Failed to load from Drive" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
