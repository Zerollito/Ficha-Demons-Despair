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

  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'rpg-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // Required for SameSite=None
      sameSite: 'none', // Required for cross-origin iframe
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));

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

  // 1. Logging Middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // 2. API Router
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // --- Google OAuth Routes ---
  apiRouter.get("/auth/google/url", (req, res) => {
    const oauth2Client = getOAuth2Client();
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
  });

  apiRouter.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code as string);
      (req.session as any).tokens = tokens;
      
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
            <p>Autenticação bem-sucedida! Esta janela fechará automaticamente.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
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
