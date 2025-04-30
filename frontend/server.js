const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { createProxyServer } = require('http-proxy');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const wsHandle = app.getUpgradeHandler();

// 后端地址
const HTTP_BACKEND = 'http://localhost:5010';
const WS_BACKEND = 'ws://localhost:5010';
const MINIO_BACKEND = 'http://47.111.114.174:9010';
const PORT = 3000

const proxy = createProxyServer();
app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // 代理普通 HTTP 请求
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/voice/')) {
      proxy.web(req, res, { target: HTTP_BACKEND });
    } else if (pathname.startsWith('/nexent/') || pathname.includes('nexent-minio:9000/nexent/')) {
      // 处理Minio请求，同时兼容原始nexent-minio:9000和新的路径格式
      const pathRewrite = pathname.replace('nexent-minio:9000/', '');
      req.url = pathRewrite;
      proxy.web(req, res, { target: MINIO_BACKEND });
    } else {
      handle(req, res, parsedUrl);
    }
  });

  // 代理 WebSocket 请求
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname.startsWith('/api/voice/')) {
      proxy.ws(req, socket, head, { target: WS_BACKEND });
    } else {
      wsHandle(req, socket, head);
    }
  });

  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});