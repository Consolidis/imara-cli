import express, { Express, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { Server as HttpServer } from 'http';
import { validatePath, isFileTransferAllowed } from './path-guard';

/**
 * Configure et retourne une application Express prête à servir l'IDE Web.
 *
 * - Sert les fichiers statiques du dossier ui-dist/
 * - Bindée exclusivement sur 127.0.0.1 (localhost)
 * - Headers de sécurité stricts
 * - Endpoint de health check /api/health
 * - Endpoint de lecture de fichiers /api/files/read
 *
 * @returns { app: Express; getUiDistPath: () => string }
 */
export function createExpressApp(): {
  app: Express;
  getUiDistPath: () => string;
} {
  const app: Express = express();
  const uiDistPath = resolveUiDistPath();

  // --- Headers de sécurité ---
  app.use((_req: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
  });

  // --- Endpoint Health Check ---
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      cwd: process.cwd(),
      pid: process.pid,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
    });
  });

  // --- Endpoint lecture de fichier (REST) ---
  app.get('/api/files/read', (req: Request, res: Response) => {
    try {
      const filePath = req.query.path as string;
      console.log(`[API/files/read] Requete recue - path="${filePath}"`);
      if (!filePath) {
        console.warn(`[API/files/read] Erreur: parametre "path" manquant`);
        res.status(400).json({ error: 'Parametre "path" requis.' });
        return;
      }
      const safePath = validatePath(filePath);
      console.log(`[API/files/read] Chemin valide: ${safePath}`);
      if (!isFileTransferAllowed(safePath)) {
        console.warn(`[API/files/read] Fichier refuse (taille/inaccessible): ${safePath}`);
        res.status(400).json({ error: 'Fichier trop volumineux (>1 Mo) ou inaccessible.' });
        return;
      }
      const content = fs.readFileSync(safePath, 'utf-8');
      const stat = fs.statSync(safePath);
      console.log(`[API/files/read] Succes - fichier: ${safePath}, taille: ${stat.size} octets, contenu: ${content.length} caracteres`);
      const langMap: Record<string, string> = {
        '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript',
        '.jsx': 'javascript', '.json': 'json', '.md': 'markdown',
        '.css': 'css', '.html': 'html', '.py': 'python', '.go': 'go',
        '.rs': 'rust', '.java': 'java', '.sql': 'sql', '.yaml': 'yaml',
        '.yml': 'yaml', '.sh': 'shell', '.xml': 'xml',
      };
      const ext = path.extname(safePath).toLowerCase();
      res.json({
        path: filePath,
        content,
        language: langMap[ext] || 'plaintext',
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
      });
    } catch (err: any) {
      console.error(`[API/files/read] Erreur pour path="${req.query.path}": ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Fichiers statiques avec fallback SPA ---
  const isBuilt = fs.existsSync(uiDistPath);
  if (isBuilt) {
    app.use(express.static(uiDistPath, {
      maxAge: 0,
      etag: false,
    }));
    app.get('*', (_req: Request, res: Response) => {
      const indexPath = path.join(uiDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).json({
          message: 'Serveur IMARA actif. Interface non buildée.',
          note: 'Lancez `npm run build` dans ui/ pour generer l\'interface.',
        });
      }
    });
  } else {
    app.get('*', (_req: Request, res: Response) => {
      res.status(200).json({
        message: 'Serveur IMARA actif.',
        note: 'Frontend non buildé. Executez la commande de build depuis ui/.',
        uiDistPath,
      });
    });
  }

  return { app, getUiDistPath: () => uiDistPath };
}

function resolveUiDistPath(): string {
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'ui-dist'),
    path.join(__dirname, '..', '..', '..', 'ui-dist'),
    path.resolve(process.cwd(), 'ui-dist'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return possiblePaths[0];
}
