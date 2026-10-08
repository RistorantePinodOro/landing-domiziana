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
  for (const id of ["dati-recensioni", "blocco-recensioni", "recensione-evidenza", "attribuzione-evidenza"]) {
    assert.match(pagina, new RegExp(`id="${id}"[^>]*\\bhidden\\b`), `#${id} deve partire nascosto`);
  }
  assert.ok(pagina.includes('Voto e recensioni forniti da <span translate="no">Google Maps</span>'));
  assert.match(pagina, /id="attribuzione-evidenza"[^>]*>Recensione da <span translate="no">Google Maps<\/span>/);
  assert.ok(pagina.includes('fetch("recensioni.json"'));
});

test("senza dati resta visibile il link alle recensioni su Google Maps", () => {
  assert.match(pagina, /<div class="prova4_recensione" id="prova-recensioni">/);
  const blocco = pagina.slice(pagina.indexOf('id="prova-recensioni"'), pagina.indexOf("</div>", pagina.indexOf('id="prova-recensioni"')));
  const link = blocco.slice(blocco.indexOf("</span>\n"));
  assert.match(link, /<a data-link="recensioni"[^>]*>Leggi le recensioni su Google Maps →<\/a>/);
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
