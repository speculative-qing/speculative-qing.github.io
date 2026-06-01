import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// Support ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory data store with fallback default values
  let db = {
    prizes: [
      { id: "p1", name: "iPhone 16 Pro", weight: 1, color: "#ef4444" },
      { id: "p2", name: "iPad Air", weight: 2, color: "#f97316" },
      { id: "p3", name: "Nintendo Switch", weight: 3, color: "#eab308" },
      { id: "p4", name: "AirPods Pro", weight: 5, color: "#10b981" },
      { id: "p5", name: "100元京东卡", weight: 10, color: "#3b82f6" },
      { id: "p6", name: "谢谢参与", weight: 20, color: "#64748b" }
    ],
    config: {
      duration: 5,
      drawMode: "normal",
      soundEnabled: true
    },
    records: [] as any[]
  };

  // API endpoints
  app.get("/api/config", (req, res) => {
    res.json({ prizes: db.prizes, config: db.config });
  });

  app.post("/api/config", (req, res) => {
    const { prizes, config } = req.body;
    if (prizes) db.prizes = prizes;
    if (config) db.config = config;
    res.json({ success: true, message: "Configuration updated successfully" });
  });

  app.get("/api/records", (req, res) => {
    res.json(db.records);
  });

  app.post("/api/records", (req, res) => {
    const record = req.body;
    if (record) {
      db.records = [record, ...db.records];
    }
    res.json({ success: true, record });
  });

  app.post("/api/records/clear", (req, res) => {
    db.records = [];
    res.json({ success: true, message: "Records cleared" });
  });

  app.delete("/api/records/:id", (req, res) => {
    const { id } = req.params;
    db.records = db.records.filter(r => r.id !== id);
    res.json({ success: true, id });
  });

  // Vite middleware for development or serving built files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      // Exclude API paths
      if (req.originalUrl.startsWith('/api/')) {
        return next();
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let html = fs.readFileSync(indexPath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
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
