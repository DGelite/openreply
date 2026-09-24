const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      line = line.trim(); // Remove \r and extra spaces
      const match = line.match(/^([\w.-]+)\s*=\s*(.*)?$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        value = value.trim(); // Remove trailing \r or spaces
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (err) {
  console.error('Failed to load .env file manually:', err);
}

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = false;
const app = next({ dev });
const handle = app.getRequestHandler();

// cPanel Passenger passes the port/socket path via process.env.PORT
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  // Start background worker for Instagram automation (queue processing + polling reconciler)
  try {
    const { startInternalWorker } = require('./worker.js');
    startInternalWorker();
    console.log('> Instagram Queue Worker started successfully');
  } catch (wErr) {
    console.error('> Failed to start Instagram Queue Worker:', wErr);
  }

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}).catch((ex) => {
  console.error(ex.stack);
  process.exit(1);
});
