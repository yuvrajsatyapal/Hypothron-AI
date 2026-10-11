"""$0 real-browser integration server. Only tests import this module.

The genuine API, graph, provider adapter and PostgreSQL run unchanged; only
external provider HTTP is replaced by deterministic structured responses.
"""

import json
import os

import httpx

from hypothron.api import create_app


def wire(request: httpx.Request) -> httpx.Response:
    prompt = json.loads(request.content)["contents"][0]["parts"][0]["text"]
    context = json.loads(prompt.split("Approved context: ")[1])
    role = context["role"]
    if role == "planner":
        if not context["clarificationAnswers"]:
            reply = {"clarification": "Confirm the approved USD revenue period.", "hypotheses": []}
        else:
            reply = {
                "clarification": None,
                "hypotheses": [
                    {
                        "id": f"h{i + 1}",
                        "statement": f"Investigate approved dataset {i + 1} revenue.",
                        "datasetHash": dataset["datasetHash"],
                        "priority": i + 1,
                    }
                    for i, dataset in enumerate(context["datasets"])
                ],
            }
    elif role == "analyst":
        if len(context["evidence"]) < min(2, len(context["datasets"])):
            hypothesis = context["hypotheses"][len(context["evidence"])]
            reply = {
                "action": "execute",
                "hypothesisId": hypothesis["id"],
                "reason": "Independent evidence warrants examining the next approved dataset.",
            }
        else:
            reply = {
                "action": "finish",
                "hypothesisId": None,
                "reason": "Sufficient approved evidence collected.",
            }
    else:
        reply = {
            "conclusion": "<img src=x onerror=alert(1)> Local evidence is client-reported and does not establish causality.",
            "citations": [e["jobId"] for e in context["evidence"]],
        }
    return httpx.Response(
        200,
        json={
            "candidates": [
                {"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(reply)}]}}
            ]
        },
    )


app = create_app(
    database_url=os.environ["DATABASE_URL"], provider_transport=httpx.MockTransport(wire)
)


@app.get("/__test__/provider")
async def fixture_marker() -> dict[str, bool]:
    return {"external_http_mocked": True}
