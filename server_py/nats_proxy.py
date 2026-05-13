import asyncio
import base64
import uuid
import time
from typing import TYPE_CHECKING

import nats

if TYPE_CHECKING:
    from aiohttp.web import WebSocketResponse


class NatsProxy:
    def __init__(self, ws: "WebSocketResponse") -> None:
        self._ws = ws
        self._nc: nats.aio.client.Client | None = None
        self._discovery_sub = None
        self._seen_subjects: set[str] = set()

    async def connect(self, url: str) -> None:
        await self.disconnect()
        self._seen_subjects.clear()

        async def error_cb(e: Exception) -> None:
            await self._send({"type": "error", "message": str(e)})

        async def closed_cb() -> None:
            await self._send({"type": "error", "message": "NATS connection closed"})

        try:
            self._nc = await nats.connect(
                url,
                error_cb=error_cb,
                closed_cb=closed_cb,
            )
            info = getattr(self._nc, "_server_info", {}) or {}
            await self._send({"type": "connected", "serverInfo": info})
            await self._start_discovery()
        except Exception as e:
            await self._send({"type": "error", "message": f"Failed to connect to {url}: {e}"})

    async def publish(self, subject: str, payload: str, headers: dict[str, str] | None = None) -> None:
        if self._nc is None:
            await self._send({"type": "error", "message": "Not connected"})
            return
        try:
            data = payload.encode("utf-8")
            await self._nc.publish(subject, data, headers=headers or None)
            await self._send({"type": "published", "subject": subject})
        except Exception as e:
            await self._send({"type": "error", "message": f"Publish failed: {e}"})

    async def disconnect(self) -> None:
        if self._discovery_sub is not None:
            try:
                await self._discovery_sub.unsubscribe()
            except Exception:
                pass
            self._discovery_sub = None
        if self._nc is not None:
            try:
                await self._nc.drain()
            except Exception:
                pass
            self._nc = None

    async def _start_discovery(self) -> None:
        if self._nc is None:
            return

        async def on_msg(msg) -> None:
            data: bytes = msg.data
            try:
                text = data.decode("utf-8")
                if text.encode("utf-8") == data:
                    payload, encoding = text, "text"
                else:
                    raise ValueError
            except (UnicodeDecodeError, ValueError):
                payload = base64.b64encode(data).decode("ascii")
                encoding = "base64"

            raw_headers: dict | None = msg.headers
            headers: dict[str, str] = {}
            if raw_headers:
                for k, v in raw_headers.items():
                    headers[k] = v[0] if isinstance(v, list) else str(v)

            subject = msg.subject
            if subject not in self._seen_subjects:
                self._seen_subjects.add(subject)
                await self._send({"type": "subjects", "subjects": [subject]})

            await self._send({
                "type": "message",
                "id": str(uuid.uuid4()),
                "subject": subject,
                "replyTo": msg.reply or None,
                "payload": payload,
                "encoding": encoding,
                "headers": headers,
                "timestamp": int(time.time() * 1000),
                "size": len(data),
            })

        self._discovery_sub = await self._nc.subscribe(">", cb=on_msg)

    async def _send(self, data: dict) -> None:
        try:
            if not self._ws.closed:
                await self._ws.send_json(data)
        except Exception:
            pass
