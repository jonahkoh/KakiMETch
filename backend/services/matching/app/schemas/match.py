from typing import Literal

from pydantic import BaseModel


class EscortSuggestion(BaseModel):
    escort_id: str
    name: str
    gender: Literal["M", "F"]
    score: int
    flairs: list[str]


class MatchResult(BaseModel):
    suggestions: list[EscortSuggestion]
    warning: str | None = None
