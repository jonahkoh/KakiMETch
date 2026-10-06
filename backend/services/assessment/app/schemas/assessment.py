from typing import Literal

from pydantic import BaseModel


class AssessmentResult(BaseModel):
    decision: Literal["accepted", "rejected"]
    reasons: list[str]
    warnings: list[str]
