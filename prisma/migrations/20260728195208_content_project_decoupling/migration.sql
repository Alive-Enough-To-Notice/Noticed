/*
  Warnings:

  - You are about to drop the column `requestId` on the `ContentDraft` table. All the data in the column will be lost.
  - Added the required column `contentProjectId` to the `ContentDraft` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ContentProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "premise" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentProject_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Idea_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingRequestContentProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketingRequestId" TEXT NOT NULL,
    "contentProjectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingRequestContentProject_marketingRequestId_fkey" FOREIGN KEY ("marketingRequestId") REFERENCES "MarketingRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingRequestContentProject_contentProjectId_fkey" FOREIGN KEY ("contentProjectId") REFERENCES "ContentProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdeaContentProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ideaId" TEXT NOT NULL,
    "contentProjectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdeaContentProject_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IdeaContentProject_contentProjectId_fkey" FOREIGN KEY ("contentProjectId") REFERENCES "ContentProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContentDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentProjectId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "scheduledFor" DATETIME,
    "complianceFlag" TEXT,
    "complianceCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentDraft_contentProjectId_fkey" FOREIGN KEY ("contentProjectId") REFERENCES "ContentProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ContentDraft" ("approvedAt", "approvedBy", "body", "channel", "complianceCheckedAt", "complianceFlag", "createdAt", "id", "scheduledFor", "status", "title", "updatedAt") SELECT "approvedAt", "approvedBy", "body", "channel", "complianceCheckedAt", "complianceFlag", "createdAt", "id", "scheduledFor", "status", "title", "updatedAt" FROM "ContentDraft";
DROP TABLE "ContentDraft";
ALTER TABLE "new_ContentDraft" RENAME TO "ContentDraft";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MarketingRequestContentProject_marketingRequestId_contentProjectId_key" ON "MarketingRequestContentProject"("marketingRequestId", "contentProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaContentProject_ideaId_contentProjectId_key" ON "IdeaContentProject"("ideaId", "contentProjectId");
