"""Opt-in private encrypted object storage; never falls back to a local data directory."""

import asyncio
import os
import re
from collections.abc import Callable
from contextlib import closing
from typing import Any, TypeVar
from urllib.parse import urlsplit

import boto3  # type: ignore[import-untyped]
from botocore.exceptions import BotoCoreError, ClientError  # type: ignore[import-untyped]

T = TypeVar("T")

MAX_ARTIFACT_BYTES = 20 * 1024 * 1024
MAX_ACCOUNT_BYTES = 100 * 1024 * 1024


class CloudUnavailable(Exception):
    pass


class PrivateObjectStore:
    def __init__(self) -> None:
        self.slots = asyncio.Semaphore(2)
        self.bucket = os.getenv("S3_BUCKET", "")
        self.region = os.getenv("S3_REGION", "us-east-1")
        self.endpoint = os.getenv("S3_ENDPOINT_URL", "")
        self.access_key = os.getenv("S3_ACCESS_KEY_ID", "")
        self.secret_key = os.getenv("S3_SECRET_ACCESS_KEY", "")
        self.enabled = os.getenv("CLOUD_STORAGE_ENABLED") == "true"
        if not self.enabled:
            return
        if not self.access_key or not self.secret_key:
            raise ValueError("CLOUD_CREDENTIALS_REQUIRED")
        if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", self.bucket):
            raise ValueError("INVALID_CLOUD_BUCKET")
        if self.endpoint:
            url = urlsplit(self.endpoint)
            if (
                url.scheme != "https"
                or not url.hostname
                or url.username
                or url.password
                or url.query
                or url.fragment
            ):
                raise ValueError("INVALID_CLOUD_ENDPOINT")

    def client(self) -> Any:
        if not self.enabled:
            raise CloudUnavailable()
        from botocore.config import Config  # type: ignore[import-untyped]

        return boto3.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            endpoint_url=self.endpoint or None,
            config=Config(
                connect_timeout=5, read_timeout=20, retries={"max_attempts": 1}, proxies={}
            ),
        )

    async def perform(self, operation: Callable[[], T]) -> T:
        if self.slots.locked():
            raise CloudUnavailable()
        await self.slots.acquire()
        task = asyncio.create_task(asyncio.to_thread(operation))
        try:
            try:
                return await asyncio.shield(task)
            except asyncio.CancelledError:
                await asyncio.gather(task, return_exceptions=True)
                raise
        finally:
            self.slots.release()

    async def put(self, key: str, data: bytes) -> None:
        def upload() -> None:
            with closing(self.client()) as client:
                policy = client.get_public_access_block(Bucket=self.bucket)[
                    "PublicAccessBlockConfiguration"
                ]
                if not all(
                    policy.get(field) is True
                    for field in (
                        "BlockPublicAcls",
                        "IgnorePublicAcls",
                        "BlockPublicPolicy",
                        "RestrictPublicBuckets",
                    )
                ):
                    raise CloudUnavailable()
                client.put_object(
                    Bucket=self.bucket,
                    Key=key,
                    Body=data,
                    ContentType="application/zip",
                    ServerSideEncryption="AES256",
                )

        try:
            await self.perform(upload)
        except (BotoCoreError, ClientError, OSError, ValueError, CloudUnavailable):
            raise CloudUnavailable() from None

    async def get(self, key: str) -> bytes:
        def download() -> bytes:
            with closing(self.client()) as client:
                result = client.get_object(Bucket=self.bucket, Key=key)
                body = result["Body"]
                try:
                    data = body.read(MAX_ARTIFACT_BYTES + 1)
                finally:
                    body.close()
                if not isinstance(data, bytes) or len(data) > MAX_ARTIFACT_BYTES:
                    raise CloudUnavailable()
                return data

        try:
            return await self.perform(download)
        except (BotoCoreError, ClientError, OSError, ValueError, CloudUnavailable):
            raise CloudUnavailable() from None

    async def delete(self, key: str) -> None:
        def remove() -> None:
            with closing(self.client()) as client:
                client.delete_object(Bucket=self.bucket, Key=key)

        try:
            await self.perform(remove)
        except (BotoCoreError, ClientError, OSError, ValueError, CloudUnavailable):
            raise CloudUnavailable() from None
