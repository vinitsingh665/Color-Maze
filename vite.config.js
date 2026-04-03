import { defineConfig } from 'vite';
import path from 'path';
import { pathToFileURL } from 'url';

const vercelApiSimulator = () => ({
  name: 'vercel-api-simulator',
  configureServer(server) {
    server.middlewares.use('/api', async (req, res, next) => {
      try {
        // Find which backend file to run (e.g. /api/level or /api/score)
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        
        let route = urlObj.pathname.split('?')[0];
        if (route === '' || route === '/') {
          return next();
        }

        // Must use absolute path because Vite caches this config in node_modules/.vite-temp
        const apiPath = path.join(process.cwd(), 'api', route + '.js');
        const apiScriptUrl = pathToFileURL(apiPath).href;

        // Dynamic import to execute the Vercel Function
        const fn = await import(apiScriptUrl);

        // Vercel CLI internally mocks req.query, req.body, res.status, res.json
        req.query = Object.fromEntries(urlObj.searchParams);
        
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        // Handle POST payload
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
             if (body) req.body = JSON.parse(body);
             await fn.default(req, res);
          });
        } else {
          await fn.default(req, res);
        }
      } catch (err) {
        console.error("Local Vercel Simulator Error:", err);
        next(); // Fallback if API script doesn't exist
      }
    });
  }
});

export default defineConfig({
  plugins: [vercelApiSimulator()]
});
