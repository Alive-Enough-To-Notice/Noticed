-- CreateTable
CREATE TABLE "DraftAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentDraftId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DraftAttachment_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
