import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE_IT = join(RADICE, "test/fixtures/places-it.json");
const FIXTURE_EN = join(RADICE, "test/fixtures/places-en.json");
const ADESSO = "2026-10-05T10:00:00Z";
const ambiente = { ...process.env, PLACES_FIXTURE: FIXTURE_IT, PLACES_FIXTURE_EN: FIXTURE_EN, RECENSIONI_ADESSO: ADESSO };

function conNode() {
  const uscita = join(mkdtempSync(join(tmpdir(), "recensioni-")), "recensioni.json");
  execFileSync("node", [join(RADICE, "scripts/aggiorna-recensioni.mjs")], { env: { ...ambiente, RECENSIONI_USCITA: uscita } });
  return JSON.parse(readFileSync(uscita, "utf8"));
}

const dati = conNode();
const fixture = JSON.parse(readFileSync(FIXTURE_IT, "utf8"));

test("voto, conteggio e scheda vengono da Google così come sono", () => {
  assert.equal(dati.valutazione, fixture.rating);
  assert.equal(dati.numeroRecensioni, fixture.userRatingCount);
  assert.equal(dati.nome, fixture.displayName.text);
  assert.equal(dati.googleMapsUri, fixture.googleMapsUri);
  assert.equal(dati.aggiornato, "2026-10-05T10:00:00.000Z");
});

test("i testi sono integrali e ogni recensione ha link, data e lingua", () => {
  const originali = new Map(fixture.reviews.map((r) => [r.googleMapsUri, (r.originalText || r.text).text.replace(/\s+/g, " ").trim()]));
  for (const r of [...dati.scelte, ...dati.tutte]) {
    assert.ok(!("troncata" in r) && !("testoIntero" in r), "campi di troncatura");
    if (r.lingua === "it") assert.equal(r.testo, originali.get(r.link), r.autore);
    assert.ok(!r.testo.endsWith("…"), `${r.autore}: testo accorciato`);
    assert.match(r.link, /^https:\/\//);
    assert.match(r.data, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(["it", "en"].includes(r.lingua));
    assert.ok(r.quando.length > 0);
  }
  const lunga = dati.tutte.find((r) => r.autore === "Antonio");
  assert.ok(lunga && lunga.testo.length > 320, "la recensione lunga resta intera");
});

test("entrano solo recensioni con abbastanza stelle, testo e meno di due anni", () => {
  const autori = dati.tutte.map((r) => r.autore);
  assert.ok(!autori.includes("Luca Verdi"), "2 stelle");
  assert.ok(!autori.includes("Sara De Luca"), "testo troppo corto");
  for (const r of dati.tutte) {
    assert.ok(r.valutazione >= 4);
    assert.ok(r.testo.length >= 20);
    assert.ok(Date.parse(ADESSO) - Date.parse(r.data) <= 730 * 86400000);
  }
  const date = dati.tutte.map((r) => r.data);
  assert.deepEqual(date, [...date].sort().reverse(), "ordinate dalla più recente");
});

test("nel file ci sono solo le recensioni che la pagina mostra: 3 in riga e una in evidenza", () => {
  const chiave = (r) => `${r.autore}|${r.testo}`;
  const inRiga = new Set(dati.scelte.map(chiave));
  for (const r of dati.scelte) assert.ok(dati.tutte.some((t) => chiave(t) === chiave(r)), `${r.autore} manca da tutte`);
  const altre = dati.tutte.filter((r) => !inRiga.has(chiave(r)));
  assert.equal(altre.length, 1, "una sola recensione oltre quelle in riga");
  assert.equal(altre[0].autore, "Sandra Maloney", "la più recente tra le altre idonee");
  assert.ok(altre[0].testo.length >= 40, "in evidenza solo testi di almeno 40 caratteri");
  assert.ok(!dati.tutte.some((r) => r.autore === "Peter Short"), "idonea ma corta e non mostrata: non va nel file");
});

test("le tre in riga coprono lavoro, viaggio e cibo", () => {
  assert.deepEqual(dati.scelte.map((r) => r.categoria), ["lavoro", "viaggio", "cibo"]);
  assert.deepEqual(dati.scelte.map((r) => r.autore), ["Marco Rossi", "Giulia Bianchi", "Antonio"]);
});

test("le recensioni in inglese entrano solo se scritte in inglese, nella loro lingua", () => {
  const inglesi = dati.tutte.filter((r) => r.lingua === "en");
  assert.ok(inglesi.length >= 1);
  for (const r of inglesi) assert.ok(!/[àèéìòù]/.test(r.testo), "testo tradotto");
  assert.ok(!dati.tutte.some((r) => r.autore === "Olga Petrova"), "recensione in russo");
});

test("la versione PHP per Hostinger produce lo stesso file (salta se php manca)", (t) => {
  if (spawnSync("php", ["--version"]).status !== 0) { t.skip("php non installato"); return; }
  const cartella = mkdtempSync(join(tmpdir(), "hostinger-"));
  for (const f of ["recensioni.php", "recensioni-lib.php", "aggiorna-recensioni.php"]) cpSync(join(RADICE, "hostinger", f), join(cartella, f));
  cpSync(join(RADICE, "recensioni-escluse.txt"), join(cartella, "recensioni-escluse.txt"));
  const esito = execFileSync("php", ["aggiorna-recensioni.php"], { cwd: cartella, env: ambiente, encoding: "utf8" });
  assert.match(esito, /^Aggiornato recensioni.json/);
  const php = JSON.parse(readFileSync(join(cartella, "recensioni.json"), "utf8"));
  const senzaData = (o) => { const c = { ...o }; delete c.aggiornato; return c; };
  assert.deepEqual(senzaData(php), senzaData(dati));
  const servito = execFileSync("php", ["recensioni.php"], { cwd: cartella, env: ambiente, encoding: "utf8" });
  assert.deepEqual(senzaData(JSON.parse(servito)), senzaData(dati));
});
