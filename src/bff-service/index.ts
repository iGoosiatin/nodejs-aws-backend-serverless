import http from 'http';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

type Cache = {
  data: string;
  headers: http.IncomingHttpHeaders;
  timestamp: number;
  statusCode: number;
};

const cacheMap = new Map<string, Cache>();
const TWO_MINUTES = 120000; // 1000 * 60 * 2;
const TEN_MIMUTES = 600000; // 1000 * 60 * 10;

const isCacheble = (method: string, routeSegment: string, statusCode = 200) => {
  return method === 'GET' && routeSegment === 'product' && statusCode === 200;
};

const server = http.createServer((req, res) => {
  const reqUrl = req.url || '';
  const method = req.method || '';
  const [path, searchParams] = reqUrl.split('&');
  const [routeSegment, ...segments] = path.replace(/^\//, '').split('/');
  const route = process.env[`${routeSegment.toUpperCase()}_API_URL`];

  if (!route) {
    res.writeHead(502);
    res.end('Cannot process request');
    return;
  }

  // Cache is available only for product service GET requests
  if (isCacheble(method, routeSegment)) {
    const cache = cacheMap.get(reqUrl);

    if (cache) {
      const now = Date.now();
      if (now - cache.timestamp < TWO_MINUTES) {
        res.writeHead(cache.statusCode, cache.headers);
        res.end(cache.data);
        return;
      }
    }
  }

  const targetUrl = new URL(
    route + (segments.length ? `/${segments.join('/')}` : '') + (searchParams ? `?${searchParams}` : ''),
  );

  const isHttps = targetUrl.protocol === 'https:';

  const options = {
    hostname: targetUrl.hostname,
    servername: targetUrl.hostname,
    path: targetUrl.pathname + targetUrl.search,
    port: isHttps ? 443 : 80,
    method,
    headers: {
      ...req.headers,
      host: targetUrl.hostname,
      ...(isHttps
        ? {
            // Add recommended headers for AWS
            'X-Forwarded-Proto': 'https',
            'X-Forwarded-Port': '443',
            'X-Forwarded-For': req.socket.remoteAddress,
          }
        : {}),
    },
    rejectUnauthorized: false,
    changeOrigin: true,
  };

  const request = isHttps ? https.request : http.request;

  // Create the proxy request
  const proxyReq = request(options, proxyRes => {
    // Collect the entire response
    let data = '';

    proxyRes.on('data', chunk => {
      data += chunk;
    });

    proxyRes.on('end', () => {
      const statusCode = proxyRes.statusCode || 200;

      res.writeHead(statusCode, proxyRes.headers);
      res.end(data);

      // Don't cache server errors
      if (isCacheble(method, routeSegment, statusCode)) {
        cacheMap.set(reqUrl, {
          data,
          headers: proxyRes.headers,
          statusCode,
          timestamp: Date.now(),
        });
      }
    });
  });

  // Handle errors
  proxyReq.on('error', err => {
    console.error('Proxy Request Error:', err);
    res.writeHead(500);
    res.end('Proxy Error');
  });

  // Handle request body for POST, PUT, PATCH methods
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      // Add Content-Length header if not present
      if (!req.headers['content-length']) {
        proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
      }

      proxyReq.write(body);
      proxyReq.end();
    });

    // Handle request errors
    req.on('error', err => {
      console.error('Request Error:', err);
      proxyReq.end();
    });
  } else {
    // Reset Content-Length to prevent request timeout. Body is dropped anyway.
    proxyReq.setHeader('Content-Length', 0);
    proxyReq.end();
  }
});

// Add cache cleanup interval
setInterval(() => {
  const now = Date.now();

  for (const [key, value] of cacheMap.entries()) {
    if (now - value.timestamp > TWO_MINUTES) {
      cacheMap.delete(key);
    }
  }
}, TEN_MIMUTES);

// Start the proxy server
const BFF_PORT = process.env.BFF_PORT || 80;
server.listen(BFF_PORT, () => {
  console.log(`BFF server running on port ${BFF_PORT}`);
});

// Global error handler
server.on('error', err => {
  console.error('Server error:', err);
});
