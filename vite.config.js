import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// 本機開發伺服器才有：網頁上「存成檔案」把瀏覽器匯入的動作寫進 public/motions/<id>/，再跑 build-index 更新清單
function saveMotion() {
  return {
    name: 'save-motion',
    configureServer(server) {
      // public/motions 直接從硬碟讀：Vite 只認得啟動時就有的 public 檔案，剛存的動作會被當成找不到
      server.middlewares.use('/motions', (req, res, next) => {
        const file = join(server.config.root, 'public', 'motions', decodeURIComponent(req.url.split('?')[0]));
        if (req.method !== 'GET' || file.includes('..') || !existsSync(file) || !statSync(file).isFile()) { next(); return; }
        res.setHeader('content-type', file.endsWith('.gz') ? 'application/gzip' : 'application/json; charset=utf-8');
        res.setHeader('cache-control', 'no-cache');
        createReadStream(file).pipe(res);
      });
      server.middlewares.use('/api/save-motion', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          try {
            const { id, curves, angles, analysis } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('id 只能用英數字、底線、減號');
            const dir = join(server.config.root, 'public', 'motions', id);
            mkdirSync(dir, { recursive: true });
            for (const [name, data] of Object.entries({ curves, angles, analysis })) writeFileSync(join(dir, `${name}.json`), JSON.stringify(data), 'utf8');
            execFileSync(process.execPath, ['tools/build-index.mjs'], { cwd: server.config.root });
            res.end('ok');
          } catch (e) {
            res.statusCode = 400;
            res.end(String(e.message));
          }
        });
      });
    },
  };
}

// 兩種打包：
// - 預設（npm run build）：只產生網頁程式到 site/。角色、動作由伺服器直接從 public/ 提供（自己架站時用；Windows 上提供中的檔案會被鎖住，所以不清空 site/）
// - pages（npm run build:pages）：GitHub Pages 用，連 public/ 一起打包到 dist/，網址前綴用相對路徑
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? './' : '/',
  plugins: [saveMotion()],
  build: mode === 'pages'
    ? { outDir: 'dist', emptyOutDir: true, copyPublicDir: true, chunkSizeWarningLimit: 2000 }
    : { outDir: 'site', emptyOutDir: false, copyPublicDir: false, chunkSizeWarningLimit: 2000 },
}));
