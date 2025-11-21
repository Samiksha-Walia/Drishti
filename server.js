// Simple HTTP server for Project Drishti
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const FRONTEND_DIR = path.join(__dirname, 'frontend', 'web');
const FASTAPI_URL = 'http://localhost:8000';

// Start FastAPI server
const startFastAPIServer = () => {
  console.log('Starting FastAPI server...');
  const fastAPIProcess = exec('cd backend/app && python -m uvicorn fastapi_app:app --host 0.0.0.0 --port 8000', (error, stdout, stderr) => {
    if (error) {
      console.error(`FastAPI server error: ${error}`);
      return;
    }
    console.log(`FastAPI server output: ${stdout}`);
    if (stderr) console.error(`FastAPI server stderr: ${stderr}`);
  });
  
  fastAPIProcess.on('exit', (code) => {
    console.log(`FastAPI server exited with code ${code}`);
  });
};

// Try to start FastAPI server
try {
  startFastAPIServer();
} catch (err) {
  console.error('Failed to start FastAPI server:', err);
  console.log('Please start the FastAPI server manually: cd backend/app && python -m uvicorn fastapi_app:app --host 0.0.0.0 --port 8000');
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
  
  // Handle API requests (proxy to FastAPI backend)
  if (req.url.startsWith('/api/')) {
    // This is a very basic proxy implementation
    // In a production environment, use a proper proxy like http-proxy
    console.log(`Proxying API request to FastAPI: ${req.url}`);
    
    // Extract the endpoint from the URL (remove /api/ prefix)
    const endpoint = req.url.replace('/api/', '');
    const apiUrl = `${FASTAPI_URL}/${endpoint}`;
    
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