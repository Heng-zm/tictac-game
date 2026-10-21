import { loadConfig } from '../src/server/config';
import { MemoryGameRepository } from '../src/server/database/memory-repository';
import { createPrismaClient, PrismaGameRepository } from '../src/server/database/prisma-repository';

async function main(): Promise<void> {
  const config = loadConfig();
  const repository = config.databaseUrl
    ? new PrismaGameRepository(createPrismaClient(config.databaseUrl, config.isProduction))
    : new MemoryGameRepository();

  try {
    const summary = await repository.runMaintenance(new Date(), config.matchStaleAfterMs);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await repository.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`Cleanup failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exitCode = 1;
});
