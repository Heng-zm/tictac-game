/**
 * Runs the local Prisma CLI with DATABASE_URL pointed at DIRECT_URL when it is
 * configured. Supabase's transaction pooler (port 6543) cannot run migrations,
 * so `npm run db:migrate` and `db:migrate:dev` use this wrapper. Runtime Prisma
 * Client still connects through DATABASE_URL (the pooler in production).
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prismaCli = require.resolve('prisma/build/index.js');

const directUrl = process.env.DIRECT_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
const url = directUrl || databaseUrl;

if (!url) {
  console.error('Set DIRECT_URL (preferred) or DATABASE_URL before running Prisma.');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/prisma-cli.mjs <prisma command> [...args]');
  process.exit(1);
}

const child = spawn(process.execPath, [prismaCli, ...args], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});

child.on('error', (error) => {
  console.error('Could not start Prisma:', error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
