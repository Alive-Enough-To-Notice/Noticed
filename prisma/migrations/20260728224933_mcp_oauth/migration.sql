-- CreateTable
CREATE TABLE "McpOAuthClient" (
    "client_id" TEXT NOT NULL PRIMARY KEY,
    "client_secret_hash" TEXT,
    "client_name" TEXT,
    "redirect_uris" TEXT NOT NULL,
    "token_endpoint_auth_method" TEXT NOT NULL DEFAULT 'none',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "McpOAuthAuthorizationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code_hash" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "code_challenge" TEXT NOT NULL,
    "code_challenge_method" TEXT NOT NULL DEFAULT 'S256',
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "expires_at" DATETIME NOT NULL,
    "used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McpOAuthAuthorizationCode_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "McpOAuthClient" ("client_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "McpOAuthAccessToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token_hash" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McpOAuthAccessToken_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "McpOAuthClient" ("client_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "McpOAuthRefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token_hash" TEXT NOT NULL,
    "access_token_id" TEXT,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McpOAuthRefreshToken_access_token_id_fkey" FOREIGN KEY ("access_token_id") REFERENCES "McpOAuthAccessToken" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "McpOAuthRefreshToken_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "McpOAuthClient" ("client_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthAuthorizationCode_code_hash_key" ON "McpOAuthAuthorizationCode"("code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthAccessToken_token_hash_key" ON "McpOAuthAccessToken"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthRefreshToken_token_hash_key" ON "McpOAuthRefreshToken"("token_hash");
