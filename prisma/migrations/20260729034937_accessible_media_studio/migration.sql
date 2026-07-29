-- CreateTable
CREATE TABLE "EditDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordingId" TEXT NOT NULL,
    "startSeconds" REAL NOT NULL,
    "endSeconds" REAL NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EditDecision_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RENDERING',
    "filePath" TEXT,
    "captionsPath" TEXT,
    "mimeType" TEXT,
    "durationSeconds" REAL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MediaExport_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentProjectId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mediaKind" TEXT NOT NULL DEFAULT 'AUDIO',
    "durationSeconds" REAL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "transcript" TEXT,
    "transcriptSegments" TEXT,
    "transcriptWords" TEXT,
    "transcriptError" TEXT,
    "markerPhrase" TEXT NOT NULL DEFAULT 'scratch scratch meow',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recording_contentProjectId_fkey" FOREIGN KEY ("contentProjectId") REFERENCES "ContentProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Recording" ("contentProjectId", "createdAt", "durationSeconds", "filePath", "id", "mimeType", "status", "transcript", "transcriptError", "transcriptSegments", "updatedAt") SELECT "contentProjectId", "createdAt", "durationSeconds", "filePath", "id", "mimeType", "status", "transcript", "transcriptError", "transcriptSegments", "updatedAt" FROM "Recording";
DROP TABLE "Recording";
ALTER TABLE "new_Recording" RENAME TO "Recording";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
