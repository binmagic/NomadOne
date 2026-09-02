-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "Project" ADD COLUMN "userId" TEXT;
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

ALTER TABLE "ProviderConfig" ADD COLUMN "userId" TEXT;
CREATE INDEX "ProviderConfig_userId_idx" ON "ProviderConfig"("userId");
