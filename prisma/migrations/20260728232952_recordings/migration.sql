-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentProjectId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "durationSeconds" REAL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "transcript" TEXT,
    "transcriptSegments" TEXT,
    "transcriptError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recording_contentProjectId_fkey" FOREIGN KEY ("contentProjectId") REFERENCES "ContentProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
