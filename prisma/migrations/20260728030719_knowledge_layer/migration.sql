/*
  Warnings:

  - You are about to drop the `BrandProfile` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "ContentDraft" ADD COLUMN "complianceCheckedAt" DATETIME;
ALTER TABLE "ContentDraft" ADD COLUMN "complianceFlag" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BrandProfile";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "KnowledgeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeRecordActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeRecordId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeRecordActivity_knowledgeRecordId_fkey" FOREIGN KEY ("knowledgeRecordId") REFERENCES "KnowledgeRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentDraftKnowledgeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentDraftId" TEXT NOT NULL,
    "knowledgeRecordId" TEXT NOT NULL,
    CONSTRAINT "ContentDraftKnowledgeRecord_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentDraftKnowledgeRecord_knowledgeRecordId_fkey" FOREIGN KEY ("knowledgeRecordId") REFERENCES "KnowledgeRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentDraftKnowledgeRecord_contentDraftId_knowledgeRecordId_key" ON "ContentDraftKnowledgeRecord"("contentDraftId", "knowledgeRecordId");
