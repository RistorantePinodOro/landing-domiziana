<?php
declare(strict_types=1);

/**
 * Aggiorna recensioni.json dalla scheda Google del Lido, per hosting PHP (Hostinger e simili).
 * Stessa logica di scripts/aggiorna-recensioni.mjs (la versione per GitHub Actions): interroga
 * la Places API (New) di Google Maps Platform, prende voto, numero di recensioni e le recensioni
 * esposte da Google (al massimo 5), ne sceglie 3 (almeno 4 stelle, una per categoria) e riscrive
 * recensioni.json nella stessa cartella solo se qualcosa e' cambiato.
 *
 * Come si esegue:
 *   - dal cron di hPanel (Avanzate > Cron Job), una volta a settimana, ad esempio il lunedi' alle 7:
 *       php /home/UTENTE/domains/DOMINIO/public_html/CARTELLA/aggiorna-recensioni.php
 *   - dal browser o da un servizio webcron, con il token scritto in config.php:
 *       https://DOMINIO/CARTELLA/aggiorna-recensioni.php?token=IL_TOKEN
 *
 * Configurazione: copia config.example.php in config.php e compila api_key (e, se vuoi, place_id e token).
 * config.php viene eseguito da PHP e non stampa nulla, quindi la chiave non e' mai visibile ai visitatori.
 * Richiede PHP 8.1+ con curl, json e mbstring (standard su Hostinger).
 */

const PLACE_ID_PREDEFINITO = 'ChIJcV_Xya3fOhMRWT5u9UL0X08'; // scheda "Ristorante Pino D'Oro", Mondragone
const CAMPI = 'id,displayName,rating,userRatingCount,reviews,googleMapsUri';
const TESTO_MAX = 320;      // caratteri mostrati per recensione (oltre: "..." e link "Leggi tutto")
const TESTO_MIN = 40;       // recensioni piu' corte non vengono scelte
const VALUTAZIONE_MIN = 4;  // recensioni con meno stelle non vengono scelte
const TIMEOUT_SEC = 20;

// Una recensione per ciascuna categoria del documento della campagna, in quest'ordine.
const CATEGORIE = [
    'lavoro' => ['lavoro', 'pausa', 'veloc', 'rapid', 'servizio', 'cortes', 'gentil', 'tempi', 'puntual', 'personale', 'attent', 'professional'],
    'viaggio' => ['viaggio', 'passaggio', 'famiglia', 'bambin', 'figli', 'vacanz', 'sosta', 'strada', 'domiziana', 'torner', 'fermat', 'tappa'],
    'cibo' => ['lupin', 'spaghett', 'pesce', 'fritt', 'cucina', 'piatt', 'buon', 'mangiat', 'fresc', 'qualit', 'porzion', 'ottim', 'delizios'],
];

mb_internal_encoding('UTF-8');
$daTerminale = PHP_SAPI === 'cli';
if (!$daTerminale) {
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
}

function termina(int $codice, string $messaggio): never
{
    global $daTerminale;
    if (!$daTerminale) {
        http_response_code($codice === 0 ? 200 : ($codice === 403 ? 403 : 500));
    }
    echo $messaggio, "\n";
    exit($codice === 403 ? 1 : $codice);
}

// ---------------------------------------------------------------- configurazione
$config = [];
if (is_file(__DIR__ . '/config.php')) {
    $letto = require __DIR__ . '/config.php';
    if (is_array($letto)) {
        $config = $letto;
    }
}
$chiave = trim((string) ($config['api_key'] ?? ''));
$placeId = trim((string) ($config['place_id'] ?? '')) ?: PLACE_ID_PREDEFINITO;
$token = trim((string) ($config['token'] ?? ''));
$fixture = $daTerminale ? (getenv('PLACES_FIXTURE') ?: '') : ''; // solo per le prove senza rete

// Dal web serve il token: senza, o sbagliato, niente (cosi' nessuno puo' far consumare la quota Google).
if (!$daTerminale) {
    $ricevuto = (string) ($_GET['token'] ?? '');
    if ($token === '' || $ricevuto === '' || !hash_equals($token, $ricevuto)) {
        termina(403, 'Accesso negato.');
    }
}
if ($chiave === '' && $fixture === '') {
    termina(1, "Manca api_key: copia config.example.php in config.php e inserisci la chiave di Google Maps Platform.");
}

// ---------------------------------------------------------------- lettura dalla scheda Google
function dettagli(string $chiave, string $placeId, string $fixture): array
{
    if ($fixture !== '') {
        $dati = json_decode((string) file_get_contents($fixture), true);
        return is_array($dati) ? $dati : [];
    }
    $url = 'https://places.googleapis.com/v1/places/' . rawurlencode($placeId) . '?languageCode=it&regionCode=IT';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => TIMEOUT_SEC,
        CURLOPT_HTTPHEADER => ['X-Goog-Api-Key: ' . $chiave, 'X-Goog-FieldMask: ' . CAMPI, 'Accept: application/json'],
    ]);
    $corpo = curl_exec($ch);
    $errore = curl_error($ch);
    $stato = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($corpo === false) {
        throw new RuntimeException('Google non raggiungibile: ' . $errore);
    }
    if ($stato !== 200) {
        throw new RuntimeException('Places API ' . $stato . ': ' . mb_substr((string) $corpo, 0, 300));
    }
    $dati = json_decode((string) $corpo, true);
    if (!is_array($dati)) {
        throw new RuntimeException('Risposta di Google non leggibile.');
    }
    return $dati;
}

// ---------------------------------------------------------------- selezione (identica allo script Node)
function nomeBreve(?string $nome): string
{
    $parti = preg_split('/\s+/u', trim((string) $nome)) ?: [];
    $parti = array_values(array_filter($parti, static fn(string $p): bool => $p !== ''));
    if (!$parti) {
        return 'Cliente Google';
    }
    if (count($parti) === 1) {
        return $parti[0];
    }
    return $parti[0] . ' ' . mb_strtoupper(mb_substr($parti[count($parti) - 1], 0, 1)) . '.';
}

function accorcia(string $testo): array
{
    if (mb_strlen($testo) <= TESTO_MAX) {
        return [$testo, false];
    }
    $taglio = mb_strrpos(mb_substr($testo, 0, TESTO_MAX + 1), ' ');
    $fine = ($taglio !== false && $taglio > TESTO_MAX / 2) ? $taglio : TESTO_MAX;
    $breve = preg_replace('/[\s,;:]+$/u', '', mb_substr($testo, 0, $fine));
    return [$breve . "\u{2026}", true];
}

function punteggio(string $testo, array $parole): int
{
    $t = mb_strtolower($testo);
    $n = 0;
    foreach ($parole as $p) {
        if (str_contains($t, $p)) {
            $n++;
        }
    }
    return $n;
}

function scegli(array $recensioni): array
{
    $valide = array_values(array_filter($recensioni, static fn(array $r): bool =>
        mb_strlen($r['testoIntero']) >= TESTO_MIN && $r['valutazione'] >= VALUTAZIONE_MIN));
    $usate = [];
    $scelte = [];
    foreach (CATEGORIE as $categoria => $parole) {
        $migliore = null;
        $max = 0;
        foreach ($valide as $i => $r) {
            if (isset($usate[$i])) {
                continue;
            }
            $s = punteggio($r['testoIntero'], $parole);
            if ($s > $max) {
                $max = $s;
                $migliore = $i;
            }
        }
        if ($migliore !== null) {
            $usate[$migliore] = true;
            $scelte[] = $valide[$migliore] + ['categoria' => $categoria];
        }
    }
    $ordine = array_keys($valide);
    usort($ordine, static fn(int $a, int $b): int =>
        [$valide[$b]['valutazione'], $valide[$b]['data']] <=> [$valide[$a]['valutazione'], $valide[$a]['data']]);
    foreach ($ordine as $i) {
        if (count($scelte) >= 3) {
            break;
        }
        if (!isset($usate[$i])) {
            $usate[$i] = true;
            $scelte[] = $valide[$i] + ['categoria' => 'altro'];
        }
    }
    return array_map(static function (array $r): array {
        unset($r['testoIntero']);
        return $r;
    }, $scelte);
}

function normalizza(array $dati, string $placeId): array
{
    $tutte = [];
    foreach ($dati['reviews'] ?? [] as $r) {
        $testoIntero = trim((string) preg_replace('/\s+/u', ' ', (string) ($r['text']['text'] ?? ($r['originalText']['text'] ?? ''))));
        if ($testoIntero === '') {
            continue;
        }
        [$testo, $troncata] = accorcia($testoIntero);
        $tutte[] = [
            'autore' => nomeBreve($r['authorAttribution']['displayName'] ?? null),
            'valutazione' => (int) ($r['rating'] ?? 0),
            'testo' => $testo,
            'troncata' => $troncata,
            'testoIntero' => $testoIntero,
            'quando' => (string) ($r['relativePublishTimeDescription'] ?? ''),
            'data' => (string) ($r['publishTime'] ?? ''),
            'link' => (string) ($r['googleMapsUri'] ?? ($dati['googleMapsUri'] ?? '')),
        ];
    }
    $valutazione = $dati['rating'] ?? null;
    $numero = $dati['userRatingCount'] ?? null;
    return [
        'aggiornato' => (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z'),
        'placeId' => (string) ($dati['id'] ?? $placeId),
        'nome' => (string) ($dati['displayName']['text'] ?? ''),
        'googleMapsUri' => (string) ($dati['googleMapsUri'] ?? ''),
        'valutazione' => is_int($valutazione) || is_float($valutazione) ? $valutazione : null,
        'numeroRecensioni' => is_int($numero) ? $numero : null,
        'scelte' => scegli($tutte),
        'tutte' => array_map(static function (array $r): array {
            unset($r['testoIntero']);
            return $r;
        }, $tutte),
    ];
}

function codifica(array $dati): string
{
    return json_encode($dati, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION) . "\n";
}

function senzaData(array $dati): string
{
    unset($dati['aggiornato']);
    return json_encode($dati, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// ---------------------------------------------------------------- esecuzione
$uscita = __DIR__ . '/recensioni.json';
try {
    $nuovo = normalizza(dettagli($chiave, $placeId, $fixture), $placeId);
} catch (Throwable $e) {
    termina(1, 'Errore: ' . $e->getMessage());
}
$precedente = is_file($uscita) ? json_decode((string) file_get_contents($uscita), true) : null;
$riassunto = sprintf('%s su Google, %s recensioni, %d mostrate', $nuovo['valutazione'] ?? '-', $nuovo['numeroRecensioni'] ?? '-', count($nuovo['scelte']));
if (is_array($precedente) && senzaData($precedente) === senzaData($nuovo)) {
    termina(0, "Nessuna novita': $riassunto.");
}
$temporaneo = $uscita . '.tmp';
if (file_put_contents($temporaneo, codifica($nuovo)) === false || !rename($temporaneo, $uscita)) {
    termina(1, 'Errore: non riesco a scrivere recensioni.json (controlla i permessi della cartella).');
}
termina(0, "Aggiornato recensioni.json: $riassunto (" . implode(', ', array_column($nuovo['scelte'], 'categoria')) . ').');
