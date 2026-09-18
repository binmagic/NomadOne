-- CreateTable
CREATE TABLE "ForbiddenWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ForbiddenWord_word_key" ON "ForbiddenWord"("word");
CREATE INDEX "ForbiddenWord_updatedAt_idx" ON "ForbiddenWord"("updatedAt");
