-- AlterTable
ALTER TABLE "Match" ALTER COLUMN "board" TYPE TEXT;
ALTER TABLE "Match" ALTER COLUMN "board" SET DEFAULT '{}';

-- AlterTable
ALTER TABLE "Move" ALTER COLUMN "boardAfter" TYPE TEXT;
