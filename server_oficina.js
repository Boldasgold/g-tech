const http = require('http');
const path = require('path');
,const next = require('next');

const rootDir = path.resolve(__dirname);
const PORT = 3001;

console.log(`[OFICINA-NEXT] Inicializando servidor customizado Webpack na porta ${PORT}...`);

const app = next({
  dev: true,
  dir: rootDir,
  webpack: true,
  customServer: true
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  server.listen(PORT, '0.0.0.0', (err) => {
    if (err) {
      console.error('[OFICINA-NEXT] Erro no listen:', err);
      process.exit(1);
    }
    console.log(`[OFICINA-NEXT] G-Tech Vistorias V1 pronto em http://localhost:${PORT}/vistorias`);
  });
}).catch((err) => {
  console.error('[OFICINA-NEXT] Erro fatal no prepare:', err);
  process.exit(1);
});
