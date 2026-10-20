// 旅程データの暗号化/復号ツール（Node 20+、依存なし）
//   暗号化: ITINERARY_PASS=合言葉 node tools/crypt.mjs encrypt
//   復号:   ITINERARY_PASS=合言葉 node tools/crypt.mjs decrypt  (private/itinerary.json を復元)
// 方式: PBKDF2(SHA-256, 310000回) → AES-256-GCM。ブラウザ側 app.js と同じパラメータ。
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

const ITER = 310000;
const PLAIN = new URL("../private/itinerary.json", import.meta.url);
const ENC = new URL("../data/itinerary.enc.json", import.meta.url);
const b64 = (u8) => Buffer.from(u8).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));

async function pass() {
  if (process.env.ITINERARY_PASS) return process.env.ITINERARY_PASS;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const p = await rl.question("合言葉: ");
  rl.close();
  return p;
}
async function key(p, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(p), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

const cmd = process.argv[2];
if (cmd === "encrypt") {
  const plain = await readFile(PLAIN, "utf8");
  JSON.parse(plain); // 構文チェック
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await key(await pass(), salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(plain));
  await writeFile(ENC, JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)), updated: new Date().toISOString() }, null, 2) + "\n");
  console.log("書き出し: data/itinerary.enc.json");
} else if (cmd === "decrypt") {
  const e = JSON.parse(await readFile(ENC, "utf8"));
  const k = await key(await pass(), unb64(e.salt));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(e.iv) }, k, unb64(e.ct));
  await writeFile(PLAIN, new TextDecoder().decode(pt));
  console.log("復元: private/itinerary.json");
} else {
  console.error("usage: node tools/crypt.mjs encrypt|decrypt");
  process.exit(1);
}
