"""$0 real-browser integration server. Only tests import this module.

The genuine API, graph, provider adapter and PostgreSQL run unchanged; only
external provider HTTP is replaced by deterministic structured responses.
"""

import json
import os

import httpx

from hypothron.api import create_app
from hypothron.providers.catalogue import ModelCatalog


def wire(request: httpx.Request) -> httpx.Response:
    if request.method == "GET" and request.url.path == "/api/v1/models":
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": model,
                        "name": model,
                        "pricing": {"prompt": "0", "completion": "0", "request": "0"},
                        "architecture": {
                            "input_modalities": ["text"],
                            "output_modalities": ["text"],
                        },
                        "supported_parameters": [
                            "structured_outputs",
                            "response_format",
                            "temperature",
                            "max_tokens",
                        ],
                        "context_length": 32768,
                        "top_provider": {"max_completion_tokens": 1024},
                    }
                    for model in ["test/first:free", "test/second:free"]
                ]
            },
        )
    body = json.loads(request.content)
    openrouter = request.url.host == "openrouter.ai"
    if openrouter and body["model"] == "test/first:free":
        return httpx.Response(429, json={"error": {"code": 429}})
    prompt = (
        body["messages"][0]["content"] if openrouter else body["contents"][0]["parts"][0]["text"]
    )
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
    if openrouter:
        return httpx.Response(
            200,
            json={
                "model": body["model"],
                "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(reply)}}],
            },
        )
    return httpx.Response(
        200,
        json={
            "candidates": [
                {"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(reply)}]}}
            ]
        },
    )


app = create_app(
    database_url=os.environ["DATABASE_URL"],
    provider_transport=httpx.MockTransport(wire),
    model_catalog=ModelCatalog(
        transport=httpx.MockTransport(wire), fallback_models=("test/first:free", "test/second:free")
    ),
)


@app.get("/__test__/provider")
async def fixture_marker() -> dict[str, bool]:
    return {"external_http_mocked": True}
