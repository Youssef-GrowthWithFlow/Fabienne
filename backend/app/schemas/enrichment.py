from pydantic import BaseModel


class GroundingSource(BaseModel):
    title: str = ""
    uri: str = ""
