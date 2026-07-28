/** Runtime brand seed for Fly entrypoint — no TypeScript/Prisma client required. */
const Database = require("better-sqlite3");
const { randomUUID } = require("crypto");

const url = process.env.DATABASE_URL || "file:/data/noticed.db";
const path = url.replace(/^file:/, "");
const db = new Database(path);

const brands = [
  ["noticed", "Noticed", 1],
  ["infranet", "InfraNet", 0],
  ["alive-enough-to-notice", "Alive Enough to Notice", 0],
  ["northbridge", "NorthBridge", 0],
];

const insert = db.prepare(
  "INSERT INTO Brand (id, key, name, isDefault) VALUES (?, ?, ?, ?)",
);
const exists = db.prepare("SELECT 1 AS ok FROM Brand WHERE key = ?");

const tx = db.transaction(() => {
  for (const [key, name, isDefault] of brands) {
    if (!exists.get(key)) {
      insert.run(randomUUID(), key, name, isDefault);
    }
  }
  const defaults = db
    .prepare("SELECT COUNT(*) AS c FROM Brand WHERE isDefault = 1")
    .get();
  if (defaults.c === 0) {
    db.prepare("UPDATE Brand SET isDefault = 1 WHERE key = 'noticed'").run();
  }
});

tx();

const rows = db
  .prepare("SELECT key, name, isDefault FROM Brand ORDER BY key")
  .all();
console.log("brands:", JSON.stringify(rows));
db.close();
