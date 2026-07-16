from datetime import date, datetime
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# CRUD schemas
# ---------------------------------------------------------------------------


class DirigeantSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    nom: str = ""
    qualite: str = ""


class EntrepriseBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    entreprise: str = ""
    site_web: str = Field(default="", alias="siteWeb")
    secteur: str = ""
    adresse: str = ""
    code_postal: str = Field(default="", alias="codePostal")
    ville: str = ""
    taille: str = ""
    linkedin: str = ""
    origine: str = ""
    signaux: list[str] = Field(default_factory=list)
    note: str = ""
    fiche_client: str = Field(default="", alias="ficheClient")
    fiche_status: str = Field(default="none", alias="ficheStatus")

    # Generic company channels
    email: str = ""

    # API gouv structured identity
    siren: str | None = None
    siret: str | None = None
    naf_code: str | None = Field(default=None, alias="nafCode")
    naf_label: str | None = Field(default=None, alias="nafLabel")
    effectif: str | None = None
    date_creation: date | None = Field(default=None, alias="dateCreation")
    dirigeants: list[DirigeantSchema] = Field(default_factory=list)

    # Google Places enrichment
    telephone: str = ""
    google_place_id: str = Field(default="", alias="googlePlaceId")
    google_maps_url: str = Field(default="", alias="googleMapsUrl")
    google_rating: float | None = Field(default=None, alias="googleRating")
    google_rating_count: int | None = Field(default=None, alias="googleRatingCount")
    latitude: float | None = None
    longitude: float | None = None

    # Per-field provenance
    field_sources: dict[str, str] = Field(
        default_factory=dict, alias="fieldSources"
    )


class EntrepriseCreate(EntrepriseBase):
    segment_id: str | None = Field(default=None, alias="segmentId")


class EntrepriseUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    segment_id: str | None = Field(default=None, alias="segmentId")
    entreprise: str | None = None
    site_web: str | None = Field(default=None, alias="siteWeb")
    secteur: str | None = None
    adresse: str | None = None
    code_postal: str | None = Field(default=None, alias="codePostal")
    ville: str | None = None
    taille: str | None = None
    linkedin: str | None = None
    origine: str | None = None
    signaux: list[str] | None = None
    note: str | None = None
    fiche_client: str | None = Field(default=None, alias="ficheClient")
    fiche_status: str | None = Field(default=None, alias="ficheStatus")
    email: str | None = None
    siren: str | None = None
    siret: str | None = None
    naf_code: str | None = Field(default=None, alias="nafCode")
    naf_label: str | None = Field(default=None, alias="nafLabel")
    effectif: str | None = None
    date_creation: date | None = Field(default=None, alias="dateCreation")
    dirigeants: list[DirigeantSchema] | None = None
    telephone: str | None = None
    google_place_id: str | None = Field(default=None, alias="googlePlaceId")
    google_maps_url: str | None = Field(default=None, alias="googleMapsUrl")
    google_rating: float | None = Field(default=None, alias="googleRating")
    google_rating_count: int | None = Field(default=None, alias="googleRatingCount")
    latitude: float | None = None
    longitude: float | None = None
    field_sources: dict[str, str] | None = Field(
        default=None, alias="fieldSources"
    )


class EntrepriseRead(EntrepriseBase):
    id: str
    segment_id: str | None = Field(default=None, serialization_alias="segmentId")
    created_at: datetime = Field(serialization_alias="dateAjout")


class EntrepriseSummary(BaseModel):
    """Nested representation used by ProspectRead.entreprise."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    entreprise: str = ""
    site_web: str = Field(default="", alias="siteWeb")
    ville: str = ""
    segment_id: str | None = Field(default=None, serialization_alias="segmentId")
    fiche_client: str = Field(default="", alias="ficheClient")
    fiche_status: str = Field(default="none", alias="ficheStatus")
    signaux: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Generation / bulk schemas
# ---------------------------------------------------------------------------


class GroundingRef(BaseModel):
    title: str = ""
    uri: str = ""


class ProposedContact(BaseModel):
    nom: str = ""
    role: str = ""
    # Optional provenance carried through to per-prospect field_sources.
    # When absent at /bulk time, the endpoint falls back to a heuristic
    # (api_gouv if (nom,role) matches a dirigeant, else gemini).
    source: str | None = None


class ProposedEntreprise(BaseModel):
    # Transient streaming identifier — assigned at generation time so the
    # frontend can match a `candidate_raw` SSE event with its later
    # `candidate_enriched` patch. Survives persistence as harmless metadata.
    temp_id: str = Field(
        default_factory=lambda: uuid4().hex[:12], alias="tempId"
    )

    entreprise: str = ""
    site_web: str = Field(default="", alias="siteWeb")
    secteur: str = ""
    adresse: str = ""
    code_postal: str = Field(default="", alias="codePostal")
    ville: str = ""
    taille: str = ""
    raison: str = ""
    signaux: list[str] = Field(default_factory=list)
    contacts: list[ProposedContact] = Field(default_factory=list)
    sources: list[GroundingRef] = Field(default_factory=list)

    # Optional API-gouv enrichment carried through to /bulk persistence.
    siren: str | None = None
    siret: str | None = None
    naf_code: str | None = Field(default=None, alias="nafCode")
    naf_label: str | None = Field(default=None, alias="nafLabel")
    effectif: str | None = None
    date_creation: date | None = Field(default=None, alias="dateCreation")
    dirigeants: list[DirigeantSchema] = Field(default_factory=list)
    # Google Places enrichment (carried through /bulk too).
    telephone: str = ""
    google_place_id: str = Field(default="", alias="googlePlaceId")
    google_maps_url: str = Field(default="", alias="googleMapsUrl")
    google_rating: float | None = Field(default=None, alias="googleRating")
    google_rating_count: int | None = Field(default=None, alias="googleRatingCount")
    latitude: float | None = None
    longitude: float | None = None
    field_sources: dict[str, str] = Field(
        default_factory=dict, alias="fieldSources"
    )

    model_config = ConfigDict(populate_by_name=True)


class SourcingResult(BaseModel):
    """Return type of ``generate_entreprises`` (internal sourcing pipeline)."""


    candidates: list[ProposedEntreprise] = Field(default_factory=list)
    search_queries: list[str] = Field(
        default_factory=list, serialization_alias="searchQueries"
    )
    grounding: list[GroundingRef] = Field(default_factory=list)


