// Single public port for the all-in-one container: /ws (websocket) goes to the API,
// everything else to Next.js, which itself proxies /api/v1 to the API.
import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.PORT ?? 8080);
const WEB = { host: '127.0.0.1', port: 3000 };
const API = { host: '127.0.0.1', port: 4000 };
const target = (url = '') => (url.startsWith('/ws') ? API : WEB);

const server = http.createServer((req, res) => {
  const t = target(req.url);
  const up = http.request({ ...t, method: req.method, path: req.url, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(up);
});

server.on('upgrade', (req, socket, head) => {
  const t = target(req.url);
  const up = net.connect(t.port, t.host, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(lines.join('\r\n') + '\r\n\r\n');
    if (head?.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  const close = () => (up.destroy(), socket.destroy());
  up.on('error', close);
  socket.on('error', close);
});

server.listen(PORT, () => console.log(`proxy listening on :${PORT}`));
