<?php
/**
 * Impressum und Datenschutz.
 *
 * Betreiberin ist die Universität Bayreuth — die vollständigen Pflichtangaben
 * (Vertretung, Aufsichtsbehörde, USt-IdNr.) stehen zentral und werden dorthin
 * verlinkt, statt sie hier zu doppeln und veralten zu lassen. Dieselbe Praxis
 * wie in den übrigen ZHL-Anwendungen.
 */
require __DIR__ . '/_boot.php';
auth_boot();
function esc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

$prov = llm_provenance();
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Impressum und Datenschutz · Beschreibungs-Lab</title>
<link rel="stylesheet" href="<?= esc(asset('styles.css')) ?>" />
</head>
<body>
<div class="shell">
  <header class="top">
    <div class="brand"><div class="logo" aria-hidden="true"></div><div><b>Beschreibungs-Lab</b><small>Universität Bayreuth</small></div></div>
    <div style="display:flex;align-items:center;gap:10px"><?= auth_nav_html() ?></div>
  </header>

  <nav class="breadcrumbs"><a href="index.php">Übersicht</a> <span>›</span> <b>Impressum und Datenschutz</b></nav>

  <h1 class="title">Impressum</h1>

  <section class="legal">
    <h2>Anbieterin</h2>
    <p>
      Universität Bayreuth<br>
      Zentrum für Hochschullehre (ZHL)<br>
      Universitätsstraße 30<br>
      95447 Bayreuth
    </p>
    <p>
      Die Universität Bayreuth ist eine Körperschaft des öffentlichen Rechts und zugleich staatliche Einrichtung
      (Art. 11 Abs. 1 BayHSchG). Die vollständigen Pflichtangaben nach § 5 DDG — gesetzliche Vertretung,
      zuständige Aufsichtsbehörde und Umsatzsteuer-Identifikationsnummer — finden Sie im
      <a href="https://www.uni-bayreuth.de/impressum" target="_blank" rel="noopener">zentralen Impressum der Universität Bayreuth</a>.
    </p>

    <h2>Inhaltlich verantwortlich</h2>
    <p>
      Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:<br>
      Paul Dölle<br>
      Zentrum für Hochschullehre der Universität Bayreuth<br>
      Universitätsstraße 30<br>
      95447 Bayreuth<br>
      <a href="mailto:ki-lehre@uni-bayreuth.de">ki-lehre@uni-bayreuth.de</a>
    </p>

    <h2>Diese Anwendung</h2>
    <p>
      Das „Beschreibungs-Lab“ ist ein Lehrangebot des
      <a href="https://www.zhl.uni-bayreuth.de/" target="_blank" rel="noopener">Zentrums für Hochschullehre</a>.
      Studierende beschreiben ein Medium in eigenen Worten und erhalten dazu ein maschinell erzeugtes,
      fragendes Feedback. Es handelt sich um ein Übungswerkzeug; das Feedback ist keine Bewertung und
      keine Prüfungsleistung.
    </p>
    <p>
      Fragen zur Anwendung richten Sie bitte an
      <a href="mailto:ki-lehre@uni-bayreuth.de">ki-lehre@uni-bayreuth.de</a>.
    </p>

    <h2 id="datenschutz">Datenschutz</h2>
    <p>
      Es gilt die
      <a href="https://www.zhl.uni-bayreuth.de/de/_service/datenschutzerklaerung/index.html" target="_blank" rel="noopener">Datenschutzerklärung des Zentrums für Hochschullehre</a>.
      Ergänzend gilt für diese Anwendung:
    </p>

    <h3>Welche Daten verarbeitet werden</h3>
    <ul>
      <li><b>Der Name</b>, den Sie beim Start eingeben. Eine E-Mail-Adresse oder ein Passwort werden nicht erhoben.</li>
      <li><b>Ihre Beschreibungen</b> und das dazu erzeugte Feedback, damit Sie beides später wiederfinden
          und Ihre Lehrperson den Lernstand sehen kann.</li>
      <li><b>Ein Wiedererkennungs-Cookie</b> (<code>biomech_device</code>), damit Sie auf diesem Gerät
          angemeldet bleiben. Es enthält eine Zufallskennung, keine personenbezogenen Inhalte.
          Es gibt keine Analyse- oder Werbe-Cookies und keine Einbindung externer Werbedienste.</li>
    </ul>

    <h3>Verarbeitung durch das KI-Modell</h3>
    <p>
      Zur Erzeugung des Feedbacks wird der von Ihnen geschriebene Text zusammen mit der Aufgabenstellung an den
      Dienst <b><?= esc($prov['service']) ?></b> übertragen und dort vom Modell <b><?= esc($prov['model']) ?></b>
      verarbeitet. Das ist das Erlangen National High Performance Computing Center der
      Friedrich-Alexander-Universität Erlangen-Nürnberg — eine wissenschaftliche Einrichtung in Deutschland,
      kein kommerzieller Anbieter. Übertragen wird nur der Text Ihrer Beschreibung, nicht Ihr Name.
    </p>

    <h3>Speicherdauer und Ihre Rechte</h3>
    <p>
      Ihre Daten bleiben gespeichert, bis Sie sie löschen oder die Lehrveranstaltung abgeschlossen ist.
      Unter <a href="meine-abgaben.php">Meine Abgaben</a> können Sie jederzeit
      einzelne Beschreibungen löschen, <b>alle Ihre Daten als Datei herunterladen</b> (Art. 15 und 20 DSGVO)
      und <b>Ihr Konto mit allen Beschreibungen löschen</b> (Art. 17 DSGVO).
      Für weitere Auskünfte wenden Sie sich an
      <a href="mailto:ki-lehre@uni-bayreuth.de">ki-lehre@uni-bayreuth.de</a> oder an die
      Datenschutzbeauftragte der Universität Bayreuth; deren Kontaktdaten stehen in der oben
      verlinkten Datenschutzerklärung.
    </p>
  </section>

  <?= site_footer() ?>
</div>
</body>
</html>
