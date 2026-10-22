-- Opt-in Telegram messages when it becomes the player's turn.
ALTER TABLE "User" ADD COLUMN "turnNotifications" BOOLEAN NOT NULL DEFAULT false;
