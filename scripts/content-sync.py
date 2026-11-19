#!/usr/bin/python3
"""Inhalts-Schutz fuer scripts/deploy-php.sh.

Uebungen entstehen inzwischen auch direkt auf dem Server (Pflege > Neue Uebung,
Texte bearbeiten). Ein blindes Hochladen der lokalen content-Dateien wuerde
solche Aenderungen ueberschreiben. Deshalb vergleicht dieses Skript drei Staende:

  S = was jetzt auf dem Server liegt (frisch per SFTP geholt)
  L = was lokal liegt
  M = Stand beim letzten Deploy/Pull (Manifest .deploy-state/content.sha256)

Befehle:
  check  SERVER LOCAL MANIFEST [force]   vor dem Upload; Exit 1 bei Konflikt
  record SERVER LOCAL MANIFEST           nach dem Upload: Manifest schreiben
  pull   SERVER LOCAL MANIFEST           Server-Stand nach lokal holen

Nur Standardbibliothek; Pfade relativ zu content/.
"""
import hashlib
import os
import shutil
import sys


def scan(root):
    out = {}
    if not os.path.isdir(root):
        return out
    for d, _, files in os.walk(root):
        for f in files:
            if not f.endswith(".json"):
                continue
            p = os.path.join(d, f)
            rel = os.path.relpath(p, root).replace(os.sep, "/")
            with open(p, "rb") as fh:
                out[rel] = hashlib.sha256(fh.read()).hexdigest()
    return out


def load_manifest(path):
    if not os.path.isfile(path):
        return None
    m = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and "  " in line:
                h, rel = line.split("  ", 1)
                m[rel] = h
    return m


def write_manifest(path, m):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        for rel in sorted(m):
            fh.write(f"{m[rel]}  {rel}\n")


def lst(title, items):
    if items:
        print(f"  {title} ({len(items)}):")
        for i in sorted(items):
            print(f"    - {i}")


def check(srv, loc, man, force):
    S, L, M = scan(srv), scan(loc), load_manifest(man)
    same, local_changes, conflicts, server_only = [], [], [], []
    for rel, h in S.items():
        if rel not in L:
            server_only.append(rel)
        elif L[rel] == h:
            same.append(rel)
        elif M is not None and M.get(rel) == h:
            local_changes.append(rel)          # Server unveraendert seit letztem Deploy
        else:
            conflicts.append(rel)              # auf dem Server geaendert (oder kein Manifest)
    new_local = [r for r in L if r not in S]
    print(f"▸ Inhalts-Abgleich: {len(same)} gleich, {len(local_changes)} lokal geaendert, "
          f"{len(new_local)} neu, {len(server_only)} nur auf dem Server, {len(conflicts)} Konflikte")
    lst("lokal geaendert, wird hochgeladen", local_changes)
    lst("neu, wird hochgeladen", new_local)
    lst("nur auf dem Server (bleibt dort; mit --pull lokal holen)", server_only)
    if conflicts:
        lst("auf dem Server geaendert UND lokal anders", conflicts)
        if M is None:
            print("  Hinweis: Es gibt noch kein Manifest (erster Lauf), deshalb zaehlt jede Abweichung als Konflikt.")
        if not force:
            print("✗ Abbruch, damit keine Aenderung auf dem Server verloren geht.")
            print("  Erst Server-Stand holen:   scripts/deploy-php.sh --pull   (dann git diff pruefen)")
            print("  Oder bewusst ueberschreiben: scripts/deploy-php.sh --force-content")
            return 1
        print("  --force-content: lokale Fassung ueberschreibt diese Dateien.")
    return 0


def record(srv, loc, man):
    S, L = scan(srv), scan(loc)
    m = dict(S)        # Server-Dateien, die lokal fehlen, bleiben mit ihrem Stand drin
    m.update(L)        # alles Lokale liegt jetzt so auf dem Server
    write_manifest(man, m)
    print(f"✓ Manifest aktualisiert ({len(m)} Dateien).")
    return 0


def pull(srv, loc, man):
    S, L, M = scan(srv), scan(loc), load_manifest(man)
    taken, kept, conflicts = [], [], []
    for rel, h in S.items():
        dst = os.path.join(loc, rel)
        if rel in L and L[rel] == h:
            continue
        if rel not in L:
            action = "take"
        elif M is not None and M.get(rel) == L[rel]:
            action = "take"                    # lokal unveraendert, Server neuer
        elif M is not None and M.get(rel) == h:
            action = "keep"                    # nur lokal geaendert
        else:
            action = "conflict"
        if action == "take":
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(os.path.join(srv, rel), dst)
            taken.append(rel)
        elif action == "keep":
            kept.append(rel)
        else:
            # Beide Seiten geaendert: Server-Fassung daneben legen, nichts ueberschreiben.
            # Endung .server, damit die App sie nicht als Uebung liest.
            shutil.copyfile(os.path.join(srv, rel), dst + ".server")
            conflicts.append(rel)
    print(f"▸ Pull: {len(taken)} uebernommen, {len(kept)} lokal neuer (behalten), {len(conflicts)} Konflikte")
    lst("vom Server uebernommen", taken)
    lst("lokal neuer, behalten", kept)
    if conflicts:
        lst("beide Seiten geaendert: Server-Fassung liegt als <datei>.json.server daneben", conflicts)
        print("  Bitte von Hand zusammenfuehren und die .server-Dateien loeschen.")
    # Manifest = Server-Stand: ab jetzt gilt eine lokale Abweichung als lokale Aenderung.
    write_manifest(man, S)
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 5 or sys.argv[1] not in ("check", "record", "pull"):
        print(__doc__)
        sys.exit(2)
    cmd, srv, loc, man = sys.argv[1:5]
    if cmd == "check":
        sys.exit(check(srv, loc, man, len(sys.argv) > 5 and sys.argv[5] == "1"))
    if cmd == "record":
        sys.exit(record(srv, loc, man))
    sys.exit(pull(srv, loc, man))
