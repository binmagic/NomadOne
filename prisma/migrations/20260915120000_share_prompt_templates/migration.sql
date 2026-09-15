-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PromptTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "previewPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PromptTemplate" ("id", "title", "prompt", "previewPath", "createdAt", "updatedAt")
SELECT "id", "title", "prompt", "previewPath", "createdAt", "updatedAt" FROM "PromptTemplate";
DROP TABLE "PromptTemplate";
ALTER TABLE "new_PromptTemplate" RENAME TO "PromptTemplate";
CREATE INDEX "PromptTemplate_updatedAt_idx" ON "PromptTemplate"("updatedAt");
PRAGMA foreign_keys=ON;
