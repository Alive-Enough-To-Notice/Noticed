-- CreateTable
CREATE TABLE "ContentSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentProjectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "body" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentSource_contentProjectId_fkey" FOREIGN KEY ("contentProjectId") REFERENCES "ContentProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DraftVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DraftVersion_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DraftApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DraftApproval_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "scheduledFor" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "publishedUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleEntry_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PublishAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "url" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublishAttempt_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PublishAttempt" ("createdAt", "destination", "draftId", "error", "id", "success", "url") SELECT "createdAt", "destination", "draftId", "error", "id", "success", "url" FROM "PublishAttempt";
DROP TABLE "PublishAttempt";
ALTER TABLE "new_PublishAttempt" RENAME TO "PublishAttempt";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ContentSource_contentProjectId_checksum_key" ON "ContentSource"("contentProjectId", "checksum");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_draftId_destination_scheduledFor_key" ON "ScheduleEntry"("draftId", "destination", "scheduledFor");
