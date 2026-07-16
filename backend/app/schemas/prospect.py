from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.comment import CommentRead
from app.schemas.entreprise import EntrepriseSummary


class ProspectBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    nom: str = ""
    role: str = ""
    entreprise_id: str | None = Field(default=None, alias="entrepriseId")
    status: str = "À contacter"
    email: str = ""
    telephone: str = ""
    linkedin: str | None = None
    field_sources: dict[str, str] = Field(
        default_factory=dict, alias="fieldSources"
    )
    created_at: date = Field(alias="createdAt")
    contacted_at: date | None = Field(default=None, alias="contactedAt")
    relance_date: date | None = Field(default=None, alias="relanceDate")
    relance_note: str = Field(default="", alias="relanceNote")


class ProspectCreate(ProspectBase):
    # Free-text company name: the API finds or creates the matching
    # Entreprise when no entreprise_id is provided.
    entreprise_nom: str = Field(default="", alias="entrepriseNom")


class ProspectUpdate(ProspectBase):
    pass


class ProspectRead(ProspectBase):
    id: str
    entreprise: EntrepriseSummary | None = None
    comments: list[CommentRead] = Field(default_factory=list)
