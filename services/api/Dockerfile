FROM python:3.12.15-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258 AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.0@sha256:cdc6093146eb3ff6a40107b38f008b789e050e77ad87865e381d9917da55a168 /uv /usr/local/bin/uv
WORKDIR /app/services/api
COPY services/api/pyproject.toml services/api/uv.lock ./
COPY services/api/src ./src
RUN uv sync --frozen --no-dev --no-editable
FROM python:3.12.15-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258 AS runtime
RUN groupadd --gid 10001 hypothron && useradd --uid 10001 --gid 10001 --no-create-home hypothron
WORKDIR /app/services/api
COPY --from=build --chown=10001:10001 /app/services/api/.venv ./.venv
COPY --chown=10001:10001 services/api/alembic.ini ./
COPY --chown=10001:10001 services/api/migrations ./migrations
ENV PATH="/app/services/api/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER 10001:10001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=4 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/v1/ready', timeout=2)" || exit 1
CMD ["uvicorn", "hypothron.api:app_factory", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log", "--no-proxy-headers"]
