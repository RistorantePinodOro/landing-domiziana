<?php
declare(strict_types=1);

/**
 * Risponde al posto di recensioni.json (la regola e' in .htaccess: la pagina continua a chiedere recensioni.json).
 * Se config.php contiene la chiave e il file ha piu' di un giorno, prima lo rinnova da Google, poi lo serve.
 * Cosi' su Hostinger le recensioni si aggiornano da sole, senza cron. Se Google non risponde, serve il file
 * che c'e' e riprova al massimo ogni ora. Senza chiave, serve semplicemente il file.
 * L'intestazione X-Recensioni dice cosa e' successo: non-necessario, aggiornato, invariato, rinviato, in-corso, fallito.
 */

require __DIR__ . '/recensioni-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');

$config = leggiConfig();
$chiave = trim((string) ($config['api_key'] ?? ''));
$fixture = PHP_SAPI === 'cli' ? (getenv('PLACES_FIXTURE') ?: '') : ''; // solo per i test, mai dal web
$file = percorsoRecensioni();
$stato = 'non-necessario';

if ($chiave !== '' || $fixture !== '') {
    $eta = etaRecensioni();
    if ($eta === null || $eta >= ETA_MASSIMA_SEC) {
        $tentativo = __DIR__ . '/recensioni.ultimo-tentativo';
        if (is_file($tentativo) && time() - (filemtime($tentativo) ?: 0) < RIPROVA_DOPO_SEC) {
            $stato = 'rinviato';
        } else {
            $lucchetto = @fopen(__DIR__ . '/recensioni.lock', 'c');
            if ($lucchetto && flock($lucchetto, LOCK_EX | LOCK_NB)) {
                @touch($tentativo);
                try {
                    $esito = aggiornaRecensioni($config, $fixture);
                    $stato = $esito['cambiato'] ? 'aggiornato' : 'invariato';
                } catch (Throwable $e) {
                    $stato = 'fallito';
                    error_log('recensioni.php: ' . $e->getMessage());
                }
                flock($lucchetto, LOCK_UN);
            } else {
                $stato = 'in-corso';
            }
            if ($lucchetto) {
                fclose($lucchetto);
            }
        }
    }
}

header('X-Recensioni: ' . $stato);
if (is_file($file)) {
    readfile($file);
} else {
    echo '{"aggiornato":null,"scelte":[],"tutte":[]}', "\n";
}
