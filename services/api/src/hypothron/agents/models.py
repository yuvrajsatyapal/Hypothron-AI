import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Hash = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Column = Annotated[str, Field(pattern=r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")]
Short = Annotated[str, Field(min_length=1, max_length=240)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class MetricPlan(StrictModel):
    version: Literal[1]
    kind: Literal["revenue_sum"]
    dataset_hash: Hash = Field(alias="datasetHash")
    amount_column: Column = Field(alias="amountColumn")
    date_column: Column = Field(alias="dateColumn")
    start: str
    end: str
    timezone: Literal["UTC"]
    currency: Literal["USD"]
    null_policy: Literal["exclude", "error"] = Field(alias="nullPolicy")

    @model_validator(mode="after")
    def period(self) -> "MetricPlan":
        values = []
        for value in (self.start, self.end):
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", value):
                raise ValueError("INVALID_PERIOD")
            values.append(datetime.fromisoformat(value))
        if values[0] >= values[1]:
            raise ValueError("INVALID_PERIOD")
        return self


class Dataset(StrictModel):
    dataset_hash: Hash = Field(alias="datasetHash")
    columns: Annotated[list[Column], Field(min_length=2, max_length=128)]
    contract: MetricPlan

    @model_validator(mode="after")
    def binding(self) -> "Dataset":
        if (
            self.dataset_hash != self.contract.dataset_hash
            or len(set(self.columns)) != len(self.columns)
            or self.contract.amount_column not in self.columns
            or self.contract.date_column not in self.columns
        ):
            raise ValueError("INVALID_DATASET")
        return self


class RunInput(StrictModel):
    question: Annotated[str, Field(min_length=1, max_length=2000)]
    datasets: Annotated[list[Dataset], Field(min_length=1, max_length=3)]

    @model_validator(mode="after")
    def distinct(self) -> "RunInput":
        if len({d.dataset_hash for d in self.datasets}) != len(self.datasets):
            raise ValueError("DUPLICATE_DATASET")
        return self


class Hypothesis(StrictModel):
    id: Annotated[str, Field(pattern=r"^h[1-6]$")]
    statement: Short
    dataset_hash: Hash = Field(alias="datasetHash")
    priority: Annotated[int, Field(ge=1, le=6)]


class PlannerReply(StrictModel):
    clarification: Short | None
    hypotheses: Annotated[list[Hypothesis], Field(max_length=6)]

    @model_validator(mode="after")
    def exclusive(self) -> "PlannerReply":
        if (self.clarification is None) == (not self.hypotheses):
            raise ValueError("INVALID_PLANNER")
        if len({h.id for h in self.hypotheses}) != len(self.hypotheses):
            raise ValueError("DUPLICATE_HYPOTHESIS")
        return self


class AnalystReply(StrictModel):
    action: Literal["execute", "finish"]
    hypothesis_id: str | None = Field(alias="hypothesisId")
    reason: Short

    @model_validator(mode="after")
    def action_binding(self) -> "AnalystReply":
        if (self.action == "execute") != (self.hypothesis_id is not None):
            raise ValueError("INVALID_ANALYST")
        return self


class ReportReply(StrictModel):
    conclusion: Annotated[str, Field(min_length=1, max_length=2000)]
    citations: Annotated[list[str], Field(max_length=6)]


class Numeric(StrictModel):
    minor_units: Annotated[str, Field(pattern=r"^(0|-?[1-9][0-9]{0,30})$")] | None = Field(
        alias="minorUnits"
    )
    count: Annotated[int, Field(ge=0, le=100000)]

    @model_validator(mode="after")
    def population(self) -> "Numeric":
        if (self.minor_units is None) != (self.count == 0):
            raise ValueError("INVALID_NUMERIC")
        return self


class EvidenceInput(StrictModel):
    job_id: Annotated[str, Field(min_length=1, max_length=64)] = Field(alias="jobId")
    dataset_hash: Hash = Field(alias="datasetHash")
    sql: Numeric
    python: Numeric


class Clarification(StrictModel):
    answer: Annotated[str, Field(min_length=1, max_length=1000)]
