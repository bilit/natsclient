import argparse
import asyncio
import socket
import webbrowser
from pathlib import Path

from aiohttp import web

from .http_server import create_app


def find_free_port(preferred: int | None) -> int:
    if preferred is not None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("", preferred))
                return preferred
            except OSError:
                pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]


async def run(args: argparse.Namespace) -> None:
    static_dir = Path(__file__).parent.parent / "dist-client"
    port = find_free_port(args.port)
    app = create_app(static_dir, args.server)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "localhost", port)
    await site.start()

    url = f"http://localhost:{port}"
    print(f"NATS Client running at {url}")

    if not args.no_open:
        webbrowser.open(url)

    await asyncio.Event().wait()


def main() -> None:
    parser = argparse.ArgumentParser(description="Web-based NATS client")
    parser.add_argument("-s", "--server", metavar="URL", help="NATS server URL to pre-connect on launch")
    parser.add_argument("-p", "--port", type=int, metavar="PORT", help="HTTP port (default: auto)")
    parser.add_argument("--no-open", action="store_true", help="Do not auto-open browser")
    args = parser.parse_args()

    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
