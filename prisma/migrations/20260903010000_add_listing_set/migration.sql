-- AlterTable
ALTER TABLE "Project" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'DETAIL_PAGE';

CREATE INDEX "Project_userId_kind_idx" ON "Project"("userId", "kind");
