import { Container, getContainer } from '@cloudflare/containers';

interface Env {
  QIDR: DurableObjectNamespace<QidrApp>;
  [key: string]: unknown;
}

// Worker vars and secrets that are handed to the container's environment.
const PASSED = [
  'DATABASE_URL',
  'DATABASE_URL_APP',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'DATA_ENCRYPTION_KEY',
  'REDIS_URL',
  'NODE_ENV',
  'COOKIE_SECURE',
  'MFA_ENFORCE',
  'TZ_DEFAULT',
  'SHOW_DEMO_ACCOUNTS',
  'SEED_ON_START',
  'WEB_ORIGINS',
];

function containerEnv(env: Env, origin: string): Record<string, string> {
  const vars: Record<string, string> = { PORT: '8080' };
  for (const k of PASSED) {
    const v = env[k];
    if (typeof v === 'string' && v !== '') vars[k] = v;
  }
  // The API checks the browser Origin; without a fixed one, allow the origin we are served on.
  vars.WEB_ORIGINS ??= origin;
  return vars;
}

export class QidrApp extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = '30m';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = getContainer(env.QIDR);
    // No-op when already running; a cold start runs migrations before the port opens.
    await container.startAndWaitForPorts({
      startOptions: { envVars: containerEnv(env, new URL(request.url).origin) },
      cancellationOptions: { portReadyTimeoutMS: 180_000 },
    });
    return container.fetch(request);
  },
};
