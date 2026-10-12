import re
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SerializerFunctionWrapHandler,
    field_validator,
    model_serializer,
    model_validator,
)

Hash = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Column = Annotated[str, Field(pattern=r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")]
Short = Annotated[str, Field(min_length=1, max_length=240)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class Relationship(StrictModel):
    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True, frozen=True)
    dataset_hash: Hash = Field(alias="datasetHash")
    key_column: Column = Field(alias="keyColumn")
    lookup_key_column: Column = Field(alias="lookupKeyColumn")
    cardinality: Literal["one_to_one", "many_to_one"]
    population_count: Annotated[int, Field(ge=0, le=100000)] = Field(alias="populationCount")


class MetricPlan(StrictModel):
    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True, frozen=True)
    version: Literal[1, 2]
    kind: Literal["revenue_sum"]
    dataset_hash: Hash = Field(alias="datasetHash")
    amount_column: Column = Field(alias="amountColumn")
    date_column: Column = Field(alias="dateColumn")
    start: str
    end: str
    timezone: str
    currency: Literal["USD", "EUR", "JPY"]
    null_policy: Literal["exclude", "error"] = Field(alias="nullPolicy")

    grain_keys: Annotated[tuple[Column, ...], Field(min_length=1, max_length=4)] | None = Field(
        default=None, alias="grainKeys"
    )
    relationship: Relationship | None = None

    @field_validator("grain_keys", mode="before")
    @classmethod
    def freeze_grain(cls, value: Any) -> Any:
        return tuple(value) if isinstance(value, list) else value

    @model_serializer(mode="wrap")
    def serialize(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        result: dict[str, Any] = handler(self)
        if self.version == 1:
            result.pop("grainKeys", None)
            result.pop("grain_keys", None)
            result.pop("relationship", None)
        return result

    @model_validator(mode="after")
    def period(self) -> "MetricPlan":
        if self.version == 1:
            if (
                self.currency != "USD"
                or self.timezone != "UTC"
                or self.grain_keys is not None
                or self.relationship is not None
            ):
                raise ValueError("UNSUPPORTED_OPERATION")
        elif (
            self.grain_keys is None
            or len(set(self.grain_keys)) != len(self.grain_keys)
            or "relationship" not in self.model_fields_set
        ):
            raise ValueError("INVALID_GRAIN")
        if self.timezone != "UTC" and (
            not re.fullmatch(r"[+-](?:0[0-9]|1[0-4]):[0-5][0-9]", self.timezone)
            or (self.timezone[1:3] == "14" and self.timezone[4:] != "00")
        ):
            raise ValueError("UNSUPPORTED_TIMEZONE")
        values = []
        for value in (self.start, self.end):
            if not re.fullmatch(
                r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"
                + re.escape("Z" if self.timezone == "UTC" else self.timezone),
                value,
            ):
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
            or any(k not in self.columns for k in (self.contract.grain_keys or []))
            or (
                self.contract.relationship is not None
                and self.contract.relationship.key_column not in self.columns
            )
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


class NumericalClaim(StrictModel):
    kind: Literal["total", "count", "percent_change", "correlation", "contribution", "causal"]
    evidence_ids: Annotated[list[str], Field(min_length=1, max_length=2)] = Field(
        alias="evidenceIds"
    )
    dataset_hash: Hash = Field(alias="datasetHash")
    contract_hash: Hash = Field(alias="contractHash")
    value: Annotated[str, Field(pattern=r"^-?(0|[1-9][0-9]{0,30})(\.[0-9]{1,12})?$")]
    unit: Literal["minor_units", "rows", "percent"]


class ReportReply(StrictModel):
    conclusion: Annotated[str, Field(min_length=1, max_length=2000)]
    citations: Annotated[list[str], Field(max_length=6)]
    claims: Annotated[list[NumericalClaim], Field(max_length=12)] = Field(default_factory=list)


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


class DiagnosticCounts(StrictModel):
    population_rows: Annotated[int, Field(ge=0, le=100000)] = Field(alias="populationRows")
    period_rows: Annotated[int, Field(ge=0, le=100000)] = Field(alias="periodRows")
    null_amounts: Annotated[int, Field(ge=0, le=100000)] = Field(alias="nullAmounts")
    grain_unique_rows: Annotated[int, Field(ge=0, le=100000)] = Field(alias="grainUniqueRows")
    join_unique_rows: Annotated[int, Field(ge=0, le=100000)] = Field(alias="joinUniqueRows")


class Diagnostics(StrictModel):
    contract: MetricPlan
    sql: DiagnosticCounts
    python: DiagnosticCounts


class EvidenceInput(StrictModel):
    job_id: Annotated[str, Field(min_length=1, max_length=64)] = Field(alias="jobId")
    dataset_hash: Hash = Field(alias="datasetHash")
    sql: Numeric
    python: Numeric
    diagnostics: Diagnostics | None = None

    @model_serializer(mode="wrap")
    def serialize(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        result: dict[str, Any] = handler(self)
        if self.diagnostics is None:
            result.pop("diagnostics", None)
        return result


class Clarification(StrictModel):
    answer: Annotated[str, Field(min_length=1, max_length=1000)]


class ExecutionJob(StrictModel):
    kind: Literal["execution"]
    id: Annotated[str, Field(min_length=1, max_length=64)]
    hypothesis_id: Annotated[str, Field(pattern=r"^h[1-6]$")] = Field(alias="hypothesisId")
    plan: MetricPlan
    depends_on: Annotated[
        list[Annotated[str, Field(min_length=1, max_length=64)]], Field(max_length=6)
    ] = Field(alias="dependsOn")
    reason: Short
