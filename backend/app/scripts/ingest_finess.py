"""Ingest the FINESS extract from data.gouv.fr into `finess_etablissements`.

Run inside the backend container:

    docker compose exec backend uv run python -m app.scripts.ingest_finess \\
        [--source URL_OR_PATH] [--departments 09,11,12,...]

The CSV is the « extraction du fichier des établissements sanitaires et sociaux »
from https://www.data.gouv.fr/fr/datasets/finess-extraction-du-fichier-des-etablissements-sanitaires-et-sociaux/.

Format quirks handled here:

- No header row. Line 1 is metadata (`finess;etalab;…`).
- Each établissement spans TWO consecutive lines :
  - `structureet;<31 fields>`
  - `geolocalisation;<5 fields>` (sometimes absent)
- Delimiter is `;`. File claims UTF-8 but contains double-encoded mojibake
  (windows-1252 read as UTF-8 then re-encoded) — fixed in `_fix_mojibake`.

Re-runs are destructive : the table is TRUNCATEd and re-populated.
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import datetime as dt
import logging
import os
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import Iterable

from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.models.finess import FinessEtablissement

logger = logging.getLogger("ingest_finess")

# Occitanie (13 départements) + adjacents directs (8) autour de Toulouse.
DEFAULT_DEPARTMENTS = [
    # Occitanie
    "09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82",
    # Nouvelle-Aquitaine (frontière)
    "24", "47", "64",
    # Auvergne-Rhône-Alpes (frontière)
    "07", "15", "43",
    # PACA (frontière)
    "13", "84",
]

DEFAULT_SOURCE_URL = (
    "https://www.data.gouv.fr/api/1/datasets/r/"
    "98f3161f-79ff-4f16-8f6a-6d571a80fea2"
)

BATCH_SIZE = 1000


def _fix_mojibake(s: str) -> str:
    """Repair double-encoded windows-1252 → UTF-8 → UTF-8 strings."""
    if not s or ("Ã" not in s and "Â" not in s):
        return s
    try:
        return s.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return s


def _parse_date(s: str) -> dt.date | None:
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _parse_float(s: str) -> float | None:
    s = (s or "").strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _build_adresse(numvoie: str, typvoie: str, voie: str, cplt: str, lieudit: str) -> str:
    parts = [p.strip() for p in (numvoie, typvoie, voie, cplt, lieudit) if p and p.strip()]
    return " ".join(parts)


def _download(url: str, dest: Path) -> None:
    logger.info("Downloading FINESS extract from %s", url)
    req = urllib.request.Request(
        url, headers={"User-Agent": "fabienne-finess-ingest/1.0"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp, dest.open("wb") as fh:
        total = 0
        while True:
            chunk = resp.read(64 * 1024)
            if not chunk:
                break
            fh.write(chunk)
            total += len(chunk)
    logger.info("Downloaded %.1f MB to %s", total / 1_048_576, dest)


def _resolve_source(arg: str) -> Path:
    if arg.startswith(("http://", "https://")):
        tmp = Path(tempfile.gettempdir()) / "finess_extract.csv"
        _download(arg, tmp)
        return tmp
    p = Path(arg).expanduser()
    if not p.exists():
        raise SystemExit(f"FINESS source file not found: {p}")
    return p


def _iter_rows(
    path: Path, allowed_departments: set[str]
) -> Iterable[dict]:
    """Stream établissements as dicts, joining `structureet` + `geolocalisation`.

    Geolocalisation lines reference the same `nofinesset` as the previous
    structureet line — they're not always strictly adjacent, so we buffer
    pending records by FINESS id until their geo row arrives (or the file ends).
    """
    pending: dict[str, dict] = {}
    emitted: set[str] = set()

    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.reader(fh, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        for row in reader:
            if not row:
                continue
            tag = row[0]
            if tag == "structureet":
                # Layout (0-indexed) verified against the actual data.gouv.fr CSV :
                # 0 structureet, 1 nofinesset, 2 nofinessej, 3 rs, 4 rslongue,
                # 5 complrs, 6 compldistrib, 7 numvoie, 8 typvoie, 9 voie,
                # 10 compvoie, 11 lieuditbp, 12 commune (code 3 chiffres),
                # 13 departement, 14 libdepartement, 15 ligneacheminement,
                # 16 telephone, 17 telecopie, 18 categetab, 19 libcategetab,
                # 20 categagretab, 21 libcategagretab, 22 siret, 23 codeape,
                # 24 mft, 25 liblmft, 26 sph, 27 libsph,
                # 28 dateouv, 29 dateautor, 30 datemaj.
                # Note: pas de `libelape` natif (déduisible du codeape).
                def col(i: int) -> str:
                    return _fix_mojibake(row[i]) if i < len(row) else ""

                dept = col(13).strip()
                if dept not in allowed_departments:
                    continue

                nofinesset = col(1).strip()
                if not nofinesset:
                    continue

                code_commune = col(12).strip()
                rec = {
                    "nofinesset": nofinesset,
                    "nofinessej": col(2).strip(),
                    "rs": col(3),
                    "rslongue": col(4),
                    "adresse": _build_adresse(
                        col(7), col(8), col(9), col(10), col(11)
                    ),
                    # Reconstruit le code INSEE 5 chiffres dept+commune
                    # quand on est sur la métropole continentale.
                    "commune_insee": (
                        f"{dept}{code_commune}" if dept.isdigit() and code_commune else ""
                    ),
                    "departement": dept,
                    "lib_departement": col(14),
                    "ligne_acheminement": col(15),
                    "telephone": col(16).strip(),
                    "telecopie": col(17).strip(),
                    "categetab": col(18).strip(),
                    "lib_categetab": col(19),
                    "categagretab": col(20).strip(),
                    "lib_categagretab": col(21),
                    "siret": col(22).strip(),
                    "codeape": col(23).strip(),
                    "libelape": "",
                    "dateouv": _parse_date(col(28)),
                    "dateautor": _parse_date(col(29)),
                    "datemaj": _parse_date(col(30)),
                    "coord_x": None,
                    "coord_y": None,
                }
                pending[nofinesset] = rec

            elif tag == "geolocalisation":
                # 0 geolocalisation, 1 nofinesset, 2 coordX, 3 coordY,
                # 4 sourcecoordet, 5 datemajcoord
                nofinesset = (row[1] if len(row) > 1 else "").strip()
                if nofinesset in pending:
                    rec = pending[nofinesset]
                    rec["coord_x"] = _parse_float(row[2] if len(row) > 2 else "")
                    rec["coord_y"] = _parse_float(row[3] if len(row) > 3 else "")
                    yield rec
                    emitted.add(nofinesset)
                    del pending[nofinesset]
                # If we get a geo row for a record we skipped (wrong dept),
                # we just ignore it.

    # Emit anything still pending without geo coords.
    for rec in pending.values():
        if rec["nofinesset"] not in emitted:
            yield rec


async def run(source: str, departments: list[str]) -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )

    path = _resolve_source(source)
    allowed = {d.zfill(2) for d in departments}
    logger.info("Filtering on %d departments: %s", len(allowed), sorted(allowed))

    engine = create_async_engine(settings.DATABASE_URL, future=True)

    try:
        async with engine.begin() as conn:
            logger.info("Truncating finess_etablissements …")
            await conn.execute(delete(FinessEtablissement))

        total = 0
        batch: list[dict] = []
        async with engine.begin() as conn:
            for rec in _iter_rows(path, allowed):
                batch.append(rec)
                if len(batch) >= BATCH_SIZE:
                    await conn.execute(text(_insert_sql(batch[0].keys())), batch)
                    total += len(batch)
                    logger.info("Inserted %d rows so far …", total)
                    batch.clear()
            if batch:
                await conn.execute(text(_insert_sql(batch[0].keys())), batch)
                total += len(batch)

        logger.info("Done. %d FINESS établissements ingested.", total)

        async with engine.connect() as conn:
            res = await conn.execute(
                text(
                    "SELECT departement, COUNT(*) AS n "
                    "FROM finess_etablissements GROUP BY departement "
                    "ORDER BY 2 DESC"
                )
            )
            by_dept = res.all()
        logger.info("Per-department counts: %s", by_dept)
    finally:
        await engine.dispose()


def _insert_sql(keys: Iterable[str]) -> str:
    cols = list(keys)
    col_list = ", ".join(cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    # ON CONFLICT DO NOTHING in case the same nofinesset appears twice
    # (rare but possible in geo-only top-up rows).
    return (
        f"INSERT INTO finess_etablissements ({col_list}) "
        f"VALUES ({placeholders}) "
        f"ON CONFLICT (nofinesset) DO NOTHING"
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default=os.environ.get("FINESS_SOURCE", DEFAULT_SOURCE_URL),
        help=(
            "URL HTTP(S) ou chemin local du CSV FINESS. "
            f"Défaut: {DEFAULT_SOURCE_URL}"
        ),
    )
    parser.add_argument(
        "--departments",
        default=",".join(DEFAULT_DEPARTMENTS),
        help="Liste de codes département séparés par des virgules.",
    )
    args = parser.parse_args(argv)
    depts = [d.strip() for d in args.departments.split(",") if d.strip()]
    asyncio.run(run(args.source, depts))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
