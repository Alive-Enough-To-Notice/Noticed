-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KnowledgeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_KnowledgeRecord" ("content", "createdAt", "id", "source", "status", "title", "type", "updatedAt") SELECT "content", "createdAt", "id", "source", "status", "title", "type", "updatedAt" FROM "KnowledgeRecord";
DROP TABLE "KnowledgeRecord";
ALTER TABLE "new_KnowledgeRecord" RENAME TO "KnowledgeRecord";
CREATE TABLE "new_MarketingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requesterName" TEXT NOT NULL,
    "department" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "owner" TEXT,
    "missingInfo" TEXT,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketingRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MarketingRequest" ("createdAt", "department", "description", "dueDate", "id", "missingInfo", "owner", "priority", "requesterName", "status", "title", "type", "updatedAt") SELECT "createdAt", "department", "description", "dueDate", "id", "missingInfo", "owner", "priority", "requesterName", "status", "title", "type", "updatedAt" FROM "MarketingRequest";
DROP TABLE "MarketingRequest";
ALTER TABLE "new_MarketingRequest" RENAME TO "MarketingRequest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Brand_key_key" ON "Brand"("key");
