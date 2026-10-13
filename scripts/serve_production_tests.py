"""Loopback-only static server with enough backlog for parallel image-heavy tests."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class TestServer(ThreadingHTTPServer):
    request_queue_size = 128


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


root = Path(__file__).resolve().parent.parent / "dist-production"
with TestServer(("127.0.0.1", 8083), partial(Handler, directory=str(root))) as server:
    server.serve_forever()
