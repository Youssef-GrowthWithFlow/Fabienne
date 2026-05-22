from pydantic import BaseModel, ConfigDict, Field


class AISource(BaseModel):
    """A web source the user suggests to the AI agent for grounded research.

    The agent is free to use it (or not) when doing supplemental contact /
    fiche searches. URL + free-text description.
    """

    url: str = ""
    description: str = ""


class SegmentBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    nom: str = ""
    description: str = ""
    postes: list[str] = Field(default_factory=list)
    taille_structure: str = Field(default="", alias="tailleStructure")
    activite_ciblee: list[str] = Field(
        default_factory=list, alias="activiteCiblee"
    )
    zone_geographique: list[str] = Field(
        default_factory=list, alias="zoneGeographique"
    )
    pain_points: list[str] = Field(default_factory=list, alias="painPoints")
    must_have: list[str] = Field(default_factory=list, alias="mustHave")
    should_have: list[str] = Field(default_factory=list, alias="shouldHave")
    red_flags: list[str] = Field(default_factory=list, alias="redFlags")
    sources: list[str] = Field(default_factory=list)
    pitch: str = ""
    benefices: list[str] = Field(default_factory=list)
    preuves: list[str] = Field(default_factory=list)
    notes: str = ""
    data_sources: list[str] = Field(default_factory=list, alias="dataSources")
    ai_sources: list[AISource] = Field(default_factory=list, alias="aiSources")


class SegmentCreate(SegmentBase):
    pass


class SegmentUpdate(SegmentBase):
    pass


class SegmentRead(SegmentBase):
    id: str
