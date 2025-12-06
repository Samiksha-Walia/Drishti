// Simple HTTP server for Project Drishti
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3000;
const FRONTEND_DIR = path.join(__dirname, 'frontend', 'web');
const FLASK_URL = 'http://localhost:5000';

const BACKEND_APP_DIR = path.join(__dirname, 'backend', 'app');

// Start Flask server
const startFlaskServer = () => {
  console.log('Starting Flask detection API...');
  const flaskProcess = spawn('python', ['api.py'], {
    cwd: BACKEND_APP_DIR,
    stdio: 'inherit',
    shell: false
  });

  flaskProcess.on('error', (error) => {
    console.error('Failed to launch Flask API:', error);
    console.log('Tip: start it manually with "cd backend/app && python api.py"');
  });

  flaskProcess.on('exit', (code) => {
    console.log(`Flask API exited with code ${code}`);
  });

  // Ensure the Flask subprocess is closed when Node stops
  process.on('exit', () => flaskProcess.kill());
  process.on('SIGINT', () => {
    flaskProcess.kill('SIGINT');
    process.exit();
  });
};

try {
  startFlaskServer();
} catch (err) {
  console.error('Failed to start Flask API server:', err);
  console.log('Please start the Flask server manually: cd backend/app && python api.py');
}

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4'
};

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Handle API requests (proxy to Flask backend)
  if (req.url.startsWith('/api/')) {
    // This is a very basic proxy implementation
    // In a production environment, use a proper proxy like http-proxy
    console.log(`Proxying API request to Flask: ${req.url}`);
    
    // Extract the endpoint from the URL (remove /api/ prefix)
    const endpoint = req.url.replace('/api/', '');
    const apiUrl = `${FLASK_URL}/${endpoint}`;
    
    // Forward the request to FastAPI
    const options = {
      method: req.method,
      headers: req.headers
    };
    
    // Create a proxy request to FastAPI
    const proxyReq = http.request(apiUrl, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    
    // Handle errors
    proxyReq.on('error', (err) => {
      console.error(`Proxy error: ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Failed to proxy request to FastAPI backend', 
        message: err.message 
      }));
    });
    
    // Forward the request body if any
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
    
    return;
  }
  
  // Handle root URL and remove query parameters
  const urlWithoutQuery = req.url.split('?')[0];
  let filePath = urlWithoutQuery === '/' 
    ? path.join(FRONTEND_DIR, 'index.html') 
    : path.join(FRONTEND_DIR, urlWithoutQuery);
  
  // Get file extension
  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  // Read file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Page not found
        console.log(`File not found: ${filePath}`);
        fs.readFile(path.join(FRONTEND_DIR, '404.html'), (err, content) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
        });
      } else {
        // Server error
        console.error(`Server error: ${err.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Project Drishti server running at http://localhost:${PORT}/`);
  console.log(`Serving files from: ${FRONTEND_DIR}`);
});