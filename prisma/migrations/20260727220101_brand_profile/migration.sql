-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'brand',
    "voice" TEXT,
    "audiences" TEXT,
    "positioning" TEXT,
    "approvedLanguage" TEXT,
    "prohibitedLanguage" TEXT,
    "updatedAt" DATETIME NOT NULL
);
