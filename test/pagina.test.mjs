import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leggi = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const pagina = leggi("index.html");

test("la pagina pubblicata non contiene recensioni scritte a mano o segnaposto", () => {
  for (const finto of ["NomeC.", "contenuto della recensione", "Pasquale T."]) {
    assert.ok(!pagina.includes(finto), `segnaposto o recensione a mano: ${finto}`);
  }
});

test("i blocchi delle recensioni partono nascosti e hanno l'attribuzione a Google", () => {
  for (const id of ["prova-recensioni", "blocco-recensioni", "recensione-evidenza"]) {
    assert.match(pagina, new RegExp(`id="${id}"[^>]*\\bhidden\\b`), `#${id} deve partire nascosto`);
  }
  assert.ok(pagina.includes("Voto e recensioni forniti da Google Maps"));
  assert.ok(pagina.includes('fetch("recensioni.json"'));
});

test("i file PHP delle recensioni nella radice sono quelli di hostinger/", () => {
  for (const file of ["recensioni.php", "recensioni-lib.php", "aggiorna-recensioni.php", "config.example.php"]) {
    assert.equal(leggi(file), leggi(`hostinger/${file}`), file);
  }
});

test(".htaccess fa passare recensioni.json da recensioni.php e protegge i file di lavoro", () => {
  const htaccess = leggi(".htaccess");
  assert.match(htaccess, /RewriteRule \^recensioni\\\.json\$ recensioni\.php \[L\]/);
  for (const protetto of ["config\\.php", "recensioni-lib\\.php", "recensioni-escluse\\.txt", "recensioni\\.lock"]) {
    assert.ok(htaccess.includes(protetto), protetto);
  }
});
