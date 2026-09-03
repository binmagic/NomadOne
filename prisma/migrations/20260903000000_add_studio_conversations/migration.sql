-- CreateTable
CREATE TABLE "StudioConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudioConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StudioConversation_userId_updatedAt_idx" ON "StudioConversation"("userId", "updatedAt");

-- CreateTable
CREATE TABLE "StudioMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "imagePath" TEXT,
    "referencePaths" TEXT,
    "aspectRatio" TEXT,
    "modelId" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "StudioConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StudioMessage_conversationId_createdAt_idx" ON "StudioMessage"("conversationId", "createdAt");
