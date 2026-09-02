-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "allowRegister" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "AppSettings" ("id", "allowRegister", "updatedAt") VALUES ('default', false, CURRENT_TIMESTAMP);
