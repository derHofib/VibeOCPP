import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isAuthorized } from './auth.js';
import { DockerClient, UnknownServiceError, ContainerNotFoundError } from './docker-client.js';

const sharedSecret = process.env.OPS_AGENT_SHARED_SECRET;
if (!sharedSecret) {
  throw new Error('OPS_AGENT_SHARED_SECRET must be set');
}

const port = Number(process.env.PORT ?? 3100);
const dockerClient = new DockerClient();

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req, sharedSecret!)) {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }

  const url = new URL(req.url ?? '/', 'http://ops-agent');
  const segments = url.pathname.split('/').filter(Boolean);

  try {
    // GET /ops/status            -> all whitelisted services
    // GET /ops/status/:service   -> one service
    // GET /ops/logs/:service     -> tail of that service's logs
    // POST /ops/restart/:service -> restart that service
    if (req.method === 'GET' && segments[0] === 'ops' && segments[1] === 'status' && !segments[2]) {
      sendJson(res, 200, await dockerClient.getStatusAll());
      return;
    }
    if (req.method === 'GET' && segments[0] === 'ops' && segments[1] === 'status' && segments[2]) {
      sendJson(res, 200, await dockerClient.getStatus(segments[2]));
      return;
    }
    if (req.method === 'GET' && segments[0] === 'ops' && segments[1] === 'logs' && segments[2]) {
      const tailParam = url.searchParams.get('tail');
      const tail = tailParam ? Number(tailParam) : undefined;
      const logs = await dockerClient.getLogs(segments[2], tail);
      sendJson(res, 200, { service: segments[2], logs });
      return;
    }
    if (req.method === 'POST' && segments[0] === 'ops' && segments[1] === 'restart' && segments[2]) {
      await dockerClient.restart(segments[2]);
      sendJson(res, 200, { service: segments[2], restarted: true });
      return;
    }
    sendJson(res, 404, { error: 'not_found' });
  } catch (err) {
    if (err instanceof UnknownServiceError) {
      sendJson(res, 400, { error: err.message });
      return;
    }
    if (err instanceof ContainerNotFoundError) {
      sendJson(res, 404, { error: err.message });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    sendJson(res, 500, { error: 'internal_error' });
  }
}

const server = createServer((req, res) => {
  void handleRequest(req, res);
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`ops-agent listening on :${port}`);
});
