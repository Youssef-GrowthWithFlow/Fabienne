"""Ingest the Ordre National des Pharmaciens CSV export into the 3 ``ordre_*`` tables.

Run inside the backend container::

    docker compose exec backend uv run python -m app.scripts.ingest_ordre \\
        --etablissements /path/to/etablissements.csv \\
        --pharmaciens    /path/to/pharmaciens.csv \\
        --activites      /path/to/activites.csv

CSV files are exported in **UTF-16 LE** (no BOM) with ``;`` delimiter.
Field names contain accented chars (``n° RPPS``, ``Dénomination commerciale``…)
that we map explicitly to keep the script encoding-quirk tolerant.

Re-runs are destructive: each target table is TRUNCATEd before reinsert.
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import datetime as dt
import logging
import sys
from pathlib import Path
from typing import Callable, Iterable

from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.models.ordre import OrdreActivite, OrdreEtablissement, OrdrePharmacien
from app.services.api_entreprise import _normalize

logger = logging.getLogger("ingest_ordre")

BATCH_SIZE = 1000
ENCODING = "utf-16-le"


def _parse_date(s: str, *fmts: str) -> dt.date | None:
    s = (s or "").strip()
    if not s:
        return None
    for fmt in fmts:
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _iter_csv(path: Path) -> Iterable[dict[str, str]]:
    """Stream rows from a UTF-16 LE CSV. Soft-fails on garbage lines."""
    with path.open("r", encoding=ENCODING, newline="") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            if not row:
                continue
            yield row


# ---------------------------------------------------------------------------
# Per-file row mappers (CSV columns → DB row)
# ---------------------------------------------------------------------------


def _map_etablissement(row: dict[str, str]) -> dict | None:
    num = (row.get("Numéro d'établissement") or "").strip()
    if not num:
        return None
    raison = (row.get("Raison sociale") or "").strip()
    denom = (row.get("Dénomination commerciale") or "").strip()
    return {
        "numero_etablissement": num,
        "type_etablissement": (row.get("Type établissement") or "").strip(),
        "denomination_commerciale": denom,
        "raison_sociale": raison,
        "adresse": (row.get("Adresse") or "").strip(),
        "code_postal": (row.get("Code postal") or "").strip(),
        "commune": (row.get("Commune") or "").strip(),
        "departement": (row.get("Département") or "").strip(),
        "region": (row.get("Région") or "").strip(),
        "telephone": (row.get("Téléphone") or "").strip(),
        "fax": (row.get("Fax") or "").strip(),
        # Indexed normalized name: raison sociale + dénomination commerciale.
        # The lookup service ILIKEs against this.
        "nom_normalise": _normalize(f"{raison} {denom}"),
    }


def _map_pharmacien(row: dict[str, str]) -> dict | None:
    rpps = (row.get("n° RPPS") or "").strip()
    if not rpps:
        return None
    return {
        "rpps": rpps,
        "titre": (row.get("Titre") or "").strip(),
        "nom_exercice": (row.get("Nom d'exercice") or "").strip(),
        "prenom": (row.get("Prénom") or "").strip(),
        # Dates come in ISO format here: 1973-04-24.
        "date_premiere_inscription": _parse_date(
            row.get("Date de première inscription") or "", "%Y-%m-%d"
        ),
    }


def _map_activite(row: dict[str, str]) -> dict | None:
    rpps = (row.get("n° RPPS pharmacien") or "").strip()
    num = (row.get("Numéro d'établissement") or "").strip()
    fonction = (row.get("Fonction") or "").strip()
    if not (rpps and num and fonction):
        return None
    return {
        "rpps": rpps,
        "numero_etablissement": num,
        "fonction": fonction,
        # Activités utilisent DD/MM/YY (ex: '22/09/18').
        "date_inscription": _parse_date(
            row.get("Date d'inscription") or "", "%d/%m/%y", "%d/%m/%Y"
        ),
        "section": (row.get("Section") or "").strip(),
        "activite_principale": (row.get("Activité principale") or "").strip(),
    }


# ---------------------------------------------------------------------------
# Generic batched ingester
# ---------------------------------------------------------------------------


def _insert_sql(table: str, keys: Iterable[str]) -> str:
    cols = list(keys)
    col_list = ", ".join(cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    # ON CONFLICT DO NOTHING in case a CSV has dupes (the export sometimes
    # repeats activities when a pharmacien has the same role across overlapping
    # date ranges).
    return (
        f"INSERT INTO {table} ({col_list}) "
        f"VALUES ({placeholders}) "
        f"ON CONFLICT DO NOTHING"
    )


async def _ingest_file(
    engine,
    label: str,
    table: str,
    model,
    path: Path,
    mapper: Callable[[dict], dict | None],
    seen_keys: tuple[str, ...] | None = None,
) -> int:
    """Truncate-then-stream a single CSV into a single DB table.

    ``seen_keys`` is used for in-batch dedup when the same PK appears twice
    within one BATCH_SIZE window (DB ON CONFLICT handles cross-batch dupes).
    """
    logger.info("[%s] Truncating %s …", label, table)
    async with engine.begin() as conn:
        await conn.execute(delete(model))

    total = 0
    skipped = 0
    batch: list[dict] = []
    batch_keys: set = set()
    async with engine.begin() as conn:
        for row in _iter_csv(path):
            mapped = mapper(row)
            if mapped is None:
                skipped += 1
                continue
            if seen_keys:
                key = tuple(mapped[k] for k in seen_keys)
                if key in batch_keys:
                    skipped += 1
                    continue
                batch_keys.add(key)
            batch.append(mapped)
            if len(batch) >= BATCH_SIZE:
                await conn.execute(text(_insert_sql(table, batch[0].keys())), batch)
                total += len(batch)
                if total % (BATCH_SIZE * 10) == 0:
                    logger.info("[%s] Inserted %d rows so far …", label, total)
                batch.clear()
                batch_keys.clear()
        if batch:
            await conn.execute(text(_insert_sql(table, batch[0].keys())), batch)
            total += len(batch)

    logger.info("[%s] Done. %d rows inserted (%d skipped).", label, total, skipped)
    return total


async def run(
    etab_path: Path, pharm_path: Path, act_path: Path
) -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )
    engine = create_async_engine(settings.DATABASE_URL, future=True)
    try:
        # Order matters only for clarity (no FK constraints). Pharmaciens
        # first because the script logs per-file progress.
        await _ingest_file(
            engine, "PHARM", "ordre_pharmaciens", OrdrePharmacien,
            pharm_path, _map_pharmacien,
            seen_keys=("rpps",),
        )
        await _ingest_file(
            engine, "ETAB", "ordre_etablissements", OrdreEtablissement,
            etab_path, _map_etablissement,
            seen_keys=("numero_etablissement",),
        )
        await _ingest_file(
            engine, "ACT", "ordre_activites", OrdreActivite,
            act_path, _map_activite,
            seen_keys=("rpps", "numero_etablissement", "fonction"),
        )

        async with engine.connect() as conn:
            for tbl in (
                "ordre_pharmaciens",
                "ordre_etablissements",
                "ordre_activites",
            ):
                res = await conn.execute(text(f"SELECT COUNT(*) FROM {tbl}"))
                logger.info("%s: %d rows", tbl, res.scalar())
            res = await conn.execute(
                text(
                    "SELECT type_etablissement, COUNT(*) AS n "
                    "FROM ordre_etablissements GROUP BY 1 ORDER BY 2 DESC LIMIT 10"
                )
            )
            logger.info("Top etablissement types: %s", res.all())
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--etablissements", required=True, type=Path)
    parser.add_argument("--pharmaciens", required=True, type=Path)
    parser.add_argument("--activites", required=True, type=Path)
    args = parser.parse_args(argv)

    for p in (args.etablissements, args.pharmaciens, args.activites):
        if not p.exists():
            raise SystemExit(f"File not found: {p}")

    asyncio.run(run(args.etablissements, args.pharmaciens, args.activites))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
