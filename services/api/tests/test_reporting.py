import pytest


def records():
    from test_workflow import request

    contract = request()["datasets"][0]["contract"]
    return [
        {
            "contract": {**contract, "datasetHash": "a" * 64},
            "jobId": "base",
            "datasetHash": "a" * 64,
            "contractHash": "b" * 64,
            "metricVersion": 1,
            "currency": "USD",
            "verification": "VERIFIED",
            "provenance": "CLIENT_REPORTED",
            "classification": "AGREEMENT",
            "sql": {"minorUnits": "10000", "count": 3},
            "python": {"minorUnits": "10000", "count": 3},
            "dependsOn": [],
        },
        {
            "contract": {**contract, "datasetHash": "c" * 64},
            "jobId": "current",
            "datasetHash": "c" * 64,
            "contractHash": "d" * 64,
            "metricVersion": 1,
            "currency": "USD",
            "verification": "VERIFIED",
            "provenance": "CLIENT_REPORTED",
            "classification": "AGREEMENT",
            "sql": {"minorUnits": "11800", "count": 3},
            "python": {"minorUnits": "11800", "count": 3},
            "dependsOn": ["base"],
        },
    ]


def claim(**changes):
    return {
        "kind": "percent_change",
        "evidenceIds": ["base", "current"],
        "datasetHash": "c" * 64,
        "contractHash": "d" * 64,
        "value": "18",
        "unit": "percent",
        **changes,
    }


def test_report_exact_claim_uses_declared_baseline_not_existing_citation_alone():
    from hypothron.reporting import ReportError, validated_report

    report = validated_report(
        {
            "conclusion": "Evidence collected.",
            "citations": ["base", "current"],
            "claims": [claim()],
        },
        records(),
    )
    assert report["claims"][0]["value"] == "18"
    assert report["findings"][0]["relation"] == "observed"
    assert report["charts"][1]["sqlMinorUnits"] == "11800"
    assert report["source"] == "validated"
    with pytest.raises(ReportError, match="UNSUPPORTED_NUMERICAL_CLAIM"):
        validated_report(
            {
                "conclusion": "Evidence collected.",
                "citations": ["base", "current"],
                "claims": [claim(value="20")],
            },
            records(),
        )


@pytest.mark.parametrize(
    "mutation,code",
    [
        ({"citations": ["orphan"]}, "ORPHAN_CITATION"),
        ({"claims": [claim(contractHash="e" * 64)]}, "INCOMPATIBLE_CITATION"),
        ({"claims": [claim(kind="causal")]}, "UNSUPPORTED_RELATION"),
        ({"claims": [claim(kind="correlation")]}, "UNSUPPORTED_RELATION"),
        ({"claims": [claim(kind="contribution")]}, "UNSUPPORTED_RELATION"),
        (
            {"conclusion": "Revenue increased by 20% because marketing caused growth."},
            "UNTRUSTED_NARRATIVE",
        ),
    ],
)
def test_report_rejects_orphan_incompatible_and_unsupported_causal_or_prose(mutation, code):
    from hypothron.reporting import ReportError, validated_report

    with pytest.raises(ReportError, match=code):
        validated_report(
            {
                "conclusion": "Evidence collected.",
                "citations": ["base", "current"],
                "claims": [],
                **mutation,
            },
            records(),
        )


def test_report_rejects_disputed_operands_zero_baseline_and_mixed_currency():
    from hypothron.reporting import ReportError, validated_report

    for change, code in [
        ({"verification": "DISPUTED"}, "UNVERIFIED_OPERAND"),
        (
            {"sql": {"minorUnits": "0", "count": 3}, "python": {"minorUnits": "0", "count": 3}},
            "UNDEFINED_BASELINE",
        ),
        ({"currency": "JPY"}, "INCOMPATIBLE_CITATION"),
    ]:
        values = records()
        values[0].update(change)
        with pytest.raises(ReportError, match=code):
            validated_report(
                {
                    "conclusion": "Evidence collected.",
                    "citations": ["base", "current"],
                    "claims": [claim()],
                },
                values,
            )


def test_fallback_preserves_both_disputed_values_and_no_causal_claim():
    from hypothron.reporting import fallback_report

    values = records()
    values[1]["verification"] = "DISPUTED"
    values[1]["python"]["minorUnits"] = "12000"
    report = fallback_report(values, "UNSUPPORTED_NUMERICAL_CLAIM")
    assert report["findings"][1]["assessment"] == "DISPUTED"
    assert (
        report["charts"][1]["sqlMinorUnits"] == "11800"
        and report["charts"][1]["pythonMinorUnits"] == "12000"
    )
    assert report["claims"] == [] and report["source"] == "deterministic_fallback"
    assert all(f["provenance"] == "CLIENT_REPORTED" for f in report["findings"])


@pytest.mark.asyncio
async def test_graph_unsupported_number_cannot_override_verified_evidence_and_falls_back():
    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.types import Command
    from test_workflow import HASH, Script, hypotheses, request

    from hypothron.agents.workflow import build_workflow, initial_state

    provider = Script(
        [
            ("planner", hypotheses()),
            ("analyst", {"action": "execute", "hypothesisId": "h1", "reason": "Test"}),
            ("analyst", {"action": "finish", "hypothesisId": None, "reason": "Enough"}),
            (
                "report",
                {
                    "conclusion": "Revenue rose by twenty percent because marketing caused growth.",
                    "citations": [],
                },
            ),
        ]
    )
    graph = build_workflow(provider, InMemorySaver())
    cfg = {"configurable": {"thread_id": "report-reject"}}
    result = await graph.ainvoke(initial_state(request()), cfg)
    job = result["pending"]
    provider.replies[-1][1]["citations"] = [job["id"]]
    result = await graph.ainvoke(
        Command(
            resume={
                "jobId": job["id"],
                "datasetHash": HASH,
                "sql": {"minorUnits": "3033", "count": 3},
                "python": {"minorUnits": "3033", "count": 3},
            }
        ),
        cfg,
    )
    assert result["status"] == "COMPLETE"
    assert result["report"]["source"] == "deterministic_fallback"
    assert result["report"]["rejection"] == "UNTRUSTED_NARRATIVE"
    assert "twenty" not in str(result["report"])
    assert result["report"]["charts"][0]["sqlMinorUnits"] == "3033"


def test_exact_negative_fractional_percent_and_integer_claim_normalization():
    from hypothron.reporting import validated_report

    values = records()
    values[1]["sql"]["minorUnits"] = "9950"
    values[1]["python"]["minorUnits"] = "9950"
    report = validated_report(
        {
            "conclusion": "Evidence collected.",
            "citations": ["base", "current"],
            "claims": [claim(value="-0.5")],
        },
        values,
    )
    assert report["claims"][0]["value"] == "-0.5"
    report = validated_report(
        {
            "conclusion": "Evidence collected.",
            "citations": ["base"],
            "claims": [
                claim(
                    kind="total",
                    value="10000.0",
                    unit="minor_units",
                    evidenceIds=["base"],
                    datasetHash="a" * 64,
                    contractHash="b" * 64,
                )
            ],
        },
        values,
    )
    assert report["claims"][0]["value"] == "10000"


def test_disagreement_sentence_preserves_supported_claim_on_separate_verified_evidence():
    from hypothron.reporting import validated_report

    values = records()
    values[1]["verification"] = "DISPUTED"
    values[1]["python"]["minorUnits"] = "12000"
    report = validated_report(
        {
            "conclusion": "The disagreement remains unresolved.",
            "citations": ["base", "current"],
            "claims": [
                claim(
                    kind="total",
                    value="10000",
                    unit="minor_units",
                    evidenceIds=["base"],
                    datasetHash="a" * 64,
                    contractHash="b" * 64,
                )
            ],
        },
        values,
    )
    assert report["source"] == "validated"
    assert report["claims"][0]["value"] == "10000"
    assert report["findings"][1]["assessment"] == "DISPUTED"


@pytest.mark.asyncio
async def test_legacy_checkpoint_observations_hydrate_from_original_jobs_before_reporting():
    from langgraph.checkpoint.memory import InMemorySaver
    from test_workflow import HASH, Script, request

    from hypothron.agents.workflow import build_workflow, initial_state

    provider = Script(
        [("report", {"conclusion": "Local evidence agrees.", "citations": ["legacy-job"]})]
    )
    graph = build_workflow(provider, InMemorySaver())
    cfg = {"configurable": {"thread_id": "legacy-report-checkpoint"}}
    old = initial_state(request())
    old["jobs"] = [
        {
            "kind": "execution",
            "id": "legacy-job",
            "hypothesisId": "h1",
            "plan": request()["datasets"][0]["contract"],
            "dependsOn": [],
            "reason": "Original approved calculation",
        }
    ]
    old["evidence"] = [
        {
            "jobId": "legacy-job",
            "datasetHash": HASH,
            "hypothesisId": "h1",
            "sql": {"minorUnits": "3033", "count": 3},
            "python": {"minorUnits": "3033", "count": 3},
            "verification": "VERIFIED",
            "provenance": "CLIENT_REPORTED",
        }
    ]
    old["decision"] = {"action": "finish"}
    old["status"] = "REPORTING"
    await graph.aupdate_state(cfg, old, as_node="analyst")
    result = await graph.ainvoke(None, cfg)
    assert result["status"] == "COMPLETE"
    assert result["report"]["findings"][0]["metricVersion"] == 1
    assert result["report"]["charts"][0]["sqlMinorUnits"] == "3033"
    assert result["evidence"][0]["contract"] == request()["datasets"][0]["contract"]
    assert len(result["evidence"][0]["contractHash"]) == 64
    assert provider.calls == ["report"]
