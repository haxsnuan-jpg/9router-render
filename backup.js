#!/usr/bin/env node
// Push/pull the 9Router SQLite DB to a private GitHub repo so that provider
// credentials, combos and settings survive an ephemeral-host restart.
// No-ops unless BACKUP_REPO and BACKUP_TOKEN are set.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const API = process.env.BACKUP_API || "https://api.github.com";
const REPO = process.env.BACKUP_REPO || "";
const TOKEN = process.env.BACKUP_TOKEN || "";
const FILE = process.env.BACKUP_PATH || "db/data.sqlite";
const DATA_DIR = process.env.DATA_DIR || "/app/data";
const DB = path.join(DATA_DIR, "db", "data.sqlite");
const MARK = "/tmp/9router-backup.sha256";
const MAX_BYTES = 40 * 1024 * 1024;

const log = (m) => console.log(`[backup] ${m}`);

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "9router-backup",
    ...extra,
  };
}

async function restore() {
  const res = await fetch(`${API}/repos/${REPO}/contents/${FILE}`, { headers: headers() });
  if (res.status === 404) return log("no backup in repo yet, starting fresh");
  if (!res.ok) throw new Error(`GET contents ${res.status}`);
  const raw = await fetch(`${API}/repos/${REPO}/contents/${FILE}`, {
    headers: headers({ Accept: "application/vnd.github.raw" }),
  });
  if (!raw.ok) throw new Error(`GET raw ${raw.status}`);
  const buf = Buffer.from(await raw.arrayBuffer());
  if (buf.subarray(0, 15).toString() !== "SQLite format 3") throw new Error("not a sqlite file");
  fs.mkdirSync(path.dirname(DB), { recursive: true });
  fs.writeFileSync(`${DB}.tmp`, buf);
  fs.renameSync(`${DB}.tmp`, DB);
  log(`restored ${buf.length} bytes -> ${DB}`);
}

async function save() {
  if (!fs.existsSync(DB)) return log("no db yet, skipping");
  const buf = fs.readFileSync(DB);
  if (buf.length > MAX_BYTES) return log(`db too large (${buf.length} bytes), skipping`);
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  if (fs.existsSync(MARK) && fs.readFileSync(MARK, "utf8") === hash) return log("unchanged, skipping");

  const head = await fetch(`${API}/repos/${REPO}/contents/${FILE}`, { headers: headers() });
  let sha;
  if (head.ok) sha = (await head.json()).sha;
  else if (head.status !== 404) throw new Error(`GET contents ${head.status}`);

  const body = {
    message: `9router backup ${new Date().toISOString()}`,
    content: buf.toString("base64"),
  };
  if (sha) body.sha = sha;

  const put = await fetch(`${API}/repos/${REPO}/contents/${FILE}`, {
    method: "PUT",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!put.ok) throw new Error(`PUT contents ${put.status} ${await put.text()}`);
  fs.writeFileSync(MARK, hash);
  log(`uploaded ${buf.length} bytes (sha256 ${hash.slice(0, 12)})`);
}

(async () => {
  if (!REPO || !TOKEN) return log("disabled (BACKUP_REPO/BACKUP_TOKEN unset)");
  const mode = process.argv[2];
  try {
    if (mode === "restore") await restore();
    else if (mode === "save") await save();
    else throw new Error(`unknown mode: ${mode}`);
  } catch (e) {
    console.error(`[backup] ${mode} failed: ${e.message}`);
    process.exitCode = 1;
  }
})();
