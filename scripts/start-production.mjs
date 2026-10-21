/* eslint-disable no-console -- deployment scripts report status to the platform log */
/**
 * Production entrypoint: apply committed Prisma migrations before starting the
 * server. Render's free plan has no pre-deploy command, so this keeps schema
 * changes from being missed. The app is single-instance by design (in-memory
 * matchmaking and Socket.IO rooms), so a startup migration is safe here.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prismaCli = require.resolve('prisma/build/index.js');
const migrationUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!migrationUrl) {
  console.error('DATABASE_URL or DIRECT_URL is required to apply database migrations.');
  process.exit(1);
}

console.log('Applying Prisma migrations before startup...');
const migration = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: migrationUrl },
});

if (migration.error) {
  console.error('Could not start the Prisma migration command:', migration.error.message);
  process.exit(1);
}
if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

await import('../dist/server/index.js');
