/* eslint-disable no-console -- this is a command-line verification tool */
/**
 * Verify a deployed production instance without using any secrets.
 *
 * Usage:
 *   npm run check:prod -- https://your-service.onrender.com
 *   PRODUCTION_URL=https://your-service.onrender.com npm run check:prod
 */
import { randomUUID } from 'node:crypto';

const rawUrl = process.argv[2] || process.env.PRODUCTION_URL;
if (!rawUrl) {
  console.error('Usage: npm run check:prod -- https://your-service.example.com');
  process.exit(1);
}

let base;
try {
  base = new URL(rawUrl);
} catch {
  console.error('PRODUCTION_URL must be a valid absolute URL.');
  process.exit(1);
}
if (base.protocol !== 'https:') {
  console.error('Production checks require an HTTPS URL.');
  process.exit(1);
}
base.pathname = '/';
base.search = '';
base.hash = '';

const failures = [];
function check(condition, message) {
  if (condition) {
    console.log(`PASS  ${message}`);
  } else {
    failures.push(message);
    console.error(`FAIL  ${message}`);
  }
}

async function get(path, init) {
  const response = await fetch(new URL(path, base), {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Some endpoints may not return JSON on failure; the status still matters.
  }
  return { response, body };
}

try {
  const health = await get('/health');
  check(health.response.status === 200 && health.body?.status === 'ok', 'GET /health returns 200 ok');
  check(
    Boolean(health.response.headers.get('strict-transport-security')),
    'HSTS header is present',
  );

  const ready = await get('/ready');
  check(ready.response.status === 200 && ready.body?.status === 'ready', 'GET /ready confirms the database');

  const config = await get('/api/config');
  check(config.response.status === 200, 'GET /api/config returns 200');
  check(config.body?.environment === 'production', 'environment is production');
  check(config.body?.demoMode === false, 'demo mode is disabled');
  check(config.body?.devAuthEnabled === false, 'development guest auth is disabled');
  check(typeof config.body?.botUsername === 'string' && config.body.botUsername.length > 0, 'Telegram bot username is configured');
  check(
    typeof config.body?.miniAppUrl === 'string' && config.body.miniAppUrl.startsWith('https://'),
    'Mini App URL uses HTTPS',
  );

  const devAuth = await get('/api/auth/dev', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceKey: `production-check-${randomUUID()}`, displayName: 'Production check' }),
  });
  check(devAuth.response.status === 403, 'POST /api/auth/dev is rejected in production');
} catch (error) {
  failures.push(error instanceof Error ? error.message : 'Unknown production check failure');
  console.error(`FAIL  ${failures.at(-1)}`);
}

if (failures.length > 0) {
  console.error(`\nProduction check failed (${failures.length} issue${failures.length === 1 ? '' : 's'}).`);
  process.exit(1);
}

console.log('\nProduction check passed.');
