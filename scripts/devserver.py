"""Local static file server for docs/ that disables caching - convenience for dev/testing only."""

import http.server
import sys
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8420
DOCS_DIR = Path(__file__).parent.parent / "docs"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
