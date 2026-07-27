-- CreateTable
CREATE TABLE "PublishAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "url" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublishAttempt_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
