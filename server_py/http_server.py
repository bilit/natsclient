import json
from pathlib import Path

from aiohttp import web

from .nats_proxy import NatsProxy


async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    default_server: str | None = request.app["default_server"]
    proxy = NatsProxy(ws)

    if default_server:
        await proxy.connect(default_server)

    async for msg in ws:
        if msg.type == web.WSMsgType.TEXT:
            try:
                data = json.loads(msg.data)
            except Exception:
                continue
            msg_type = data.get("type")
            if msg_type == "connect":
                await proxy.connect(data["url"])
            elif msg_type == "publish":
                await proxy.publish(
                    data["subject"],
                    data.get("payload", ""),
                    data.get("headers"),
                )
            elif msg_type == "disconnect":
                await proxy.disconnect()
        elif msg.type in (web.WSMsgType.ERROR, web.WSMsgType.CLOSE):
            break

    await proxy.disconnect()
    return ws


async def spa_handler(request: web.Request) -> web.FileResponse:
    static_dir: Path = request.app["static_dir"]
    return web.FileResponse(static_dir / "index.html")


def create_app(static_dir: Path, default_server: str | None = None) -> web.Application:
    app = web.Application()
    app["static_dir"] = static_dir
    app["default_server"] = default_server

    app.router.add_get("/ws", websocket_handler)
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.router.add_static("/assets", assets_dir)
    app.router.add_route("GET", "/{path_info:.*}", spa_handler)

    return app
