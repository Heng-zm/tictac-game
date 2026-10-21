-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MatchMode" AS ENUM ('RANDOM', 'FRIEND', 'AI');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "Side" AS ENUM ('X', 'O');

-- CreateEnum
CREATE TYPE "MatchResult" AS ENUM ('X_WINS', 'O_WINS', 'DRAW');

-- CreateEnum
CREATE TYPE "FinishReason" AS ENUM ('LINE', 'DRAW', 'FORFEIT', 'DISCONNECT', 'TIMEOUT', 'SERVER_SHUTDOWN', 'CANCELLED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ParticipantOutcome" AS ENUM ('WIN', 'LOSS', 'DRAW');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AiDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" VARCHAR(64),
    "firstName" VARCHAR(128) NOT NULL,
    "lastName" VARCHAR(128),
    "photoUrl" VARCHAR(1024),
    "languageCode" VARCHAR(16),
    "autoAiFallback" BOOLEAN NOT NULL DEFAULT false,
    "activeMatchId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStats" (
    "userId" TEXT NOT NULL,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "humanGames" INTEGER NOT NULL DEFAULT 0,
    "aiGames" INTEGER NOT NULL DEFAULT 0,
    "aiWins" INTEGER NOT NULL DEFAULT 0,
    "aiLosses" INTEGER NOT NULL DEFAULT 0,
    "aiDraws" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "ratingGames" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" UUID NOT NULL,
    "mode" "MatchMode" NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'WAITING',
    "board" VARCHAR(9) NOT NULL DEFAULT '.........',
    "currentTurn" "Side",
    "turnNumber" INTEGER NOT NULL DEFAULT 0,
    "winnerSide" "Side",
    "result" "MatchResult",
    "finishReason" "FinishReason",
    "turnDeadline" TIMESTAMPTZ(3),
    "rematchOfId" UUID,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchParticipant" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "userId" TEXT,
    "side" "Side" NOT NULL,
    "isAi" BOOLEAN NOT NULL DEFAULT false,
    "aiDifficulty" "AiDifficulty",
    "displayName" VARCHAR(128) NOT NULL,
    "username" VARCHAR(64),
    "photoUrl" VARCHAR(1024),
    "outcome" "ParticipantOutcome",
    "ratingDelta" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),

    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "participantSide" "Side" NOT NULL,
    "actionId" VARCHAR(64) NOT NULL,
    "cell" INTEGER NOT NULL,
    "moveNumber" INTEGER NOT NULL,
    "boardAfter" VARCHAR(9) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "matchId" UUID NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt");

-- CreateIndex
CREATE INDEX "User_activeMatchId_idx" ON "User"("activeMatchId");

-- CreateIndex
CREATE INDEX "UserStats_rating_wins_idx" ON "UserStats"("rating" DESC, "wins" DESC);

-- CreateIndex
CREATE INDEX "UserStats_ratingGames_idx" ON "UserStats"("ratingGames");

-- CreateIndex
CREATE INDEX "Match_status_lastActivityAt_idx" ON "Match"("status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "Match_status_turnDeadline_idx" ON "Match"("status", "turnDeadline");

-- CreateIndex
CREATE INDEX "Match_mode_status_idx" ON "Match"("mode", "status");

-- CreateIndex
CREATE INDEX "Match_finishedAt_idx" ON "Match"("finishedAt");

-- CreateIndex
CREATE INDEX "MatchParticipant_userId_joinedAt_idx" ON "MatchParticipant"("userId", "joinedAt" DESC);

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_idx" ON "MatchParticipant"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchParticipant_matchId_side_key" ON "MatchParticipant"("matchId", "side");

-- CreateIndex
CREATE INDEX "Move_matchId_createdAt_idx" ON "Move"("matchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Move_matchId_actionId_key" ON "Move"("matchId", "actionId");

-- CreateIndex
CREATE UNIQUE INDEX "Move_matchId_moveNumber_key" ON "Move"("matchId", "moveNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_matchId_key" ON "Invitation"("matchId");

-- CreateIndex
CREATE INDEX "Invitation_status_expiresAt_idx" ON "Invitation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Invitation_inviterId_status_idx" ON "Invitation"("inviterId", "status");

-- AddForeignKey
ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

