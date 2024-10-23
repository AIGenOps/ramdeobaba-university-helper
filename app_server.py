#!/usr/bin/env python3
"""
RKNEc Central Library Archives — Local Web Server
Serves the luxury minimalist UI and streams question papers from ./PYQs with byte-range support.
"""

import os
import sys
import mimetypes
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")
PYQS_DIR = os.path.join(BASE_DIR, "PYQs")
CATALOG_PATH = os.path.join(BASE_DIR, "catalog.json")

class ArchiveHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)

        # Route: Homepage
        if path in ("/", "/index.html"):
            self.serve_file(os.path.join(WEB_DIR, "index.html"), "text/html; charset=utf-8")
            return

        # Route: Static Assets in web/
        local_web_file = os.path.join(WEB_DIR, path.lstrip("/"))
        if os.path.isfile(local_web_file):
            content_type, _ = mimetypes.guess_type(local_web_file)
            if not content_type:
                content_type = "application/octet-stream"
            if content_type.startswith("text/") or content_type == "application/javascript":
                content_type += "; charset=utf-8"
            self.serve_file(local_web_file, content_type)
            return

        if path in ("/catalog.json", "/catalog.min.json"):
            accept_enc = self.headers.get("Accept-Encoding", "")
            gz_path = os.path.join(BASE_DIR, "catalog.min.json.gz")
            min_path = os.path.join(BASE_DIR, "catalog.min.json")
            
            if "gzip" in accept_enc and os.path.exists(gz_path):
                with open(gz_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Cache-Control", "public, max-age=86400")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(content)
                return
            elif os.path.exists(min_path):
                self.serve_file(min_path, "application/json; charset=utf-8")
                return
            else:
                self.serve_file(CATALOG_PATH, "application/json; charset=utf-8")
                return

        # Route: PDF Documents in PYQs/
        if path.startswith("/PYQs/"):
            rel_path = path[len("/PYQs/"):].lstrip("/")
            file_path = os.path.join(PYQS_DIR, rel_path)

            # Security check: prevent directory traversal
            real_file_path = os.path.realpath(file_path)
            if not real_file_path.startswith(os.path.realpath(PYQS_DIR)):
                self.send_error(403, "Access Denied")
                return

            if not os.path.isfile(real_file_path):
                # Seamless fallback to Hugging Face CDN if file not present locally
                hf_url = f"https://huggingface.co/datasets/aigenops/rbu-pyqs/resolve/main/{urllib.parse.quote(rel_path)}"
                self.send_response(307)
                self.send_header("Location", hf_url)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                return

            self.serve_pdf(real_file_path)
            return

        self.send_error(404, "Page Not Found")

    def serve_file(self, file_path, content_type):
        if not os.path.exists(file_path):
            self.send_error(404, "File Not Found")
            return

        try:
            with open(file_path, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Internal Error: {e}")

    def serve_pdf(self, file_path):
        """Streams PDF with HTTP 206 Partial Content / Range support for instant in-browser viewing."""
        try:
            file_size = os.path.getsize(file_path)
            filename = os.path.basename(file_path)
            range_header = self.headers.get("Range")

            if range_header and range_header.startswith("bytes="):
                parts = range_header[6:].split("-")
                start = int(parts[0]) if parts[0] else 0
                end = int(parts[1]) if parts[1] else (file_size - 1)
                end = min(end, file_size - 1)
                length = end - start + 1

                self.send_response(206)
                self.send_header("Content-Type", "application/pdf")
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                self.send_header("Content-Length", str(length))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Disposition", f'inline; filename="{filename}"')
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()

                with open(file_path, "rb") as f:
                    f.seek(start)
                    self.wfile.write(f.read(length))
            else:
                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header("Content-Length", str(file_size))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Disposition", f'inline; filename="{filename}"')
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()

                with open(file_path, "rb") as f:
                    # Stream in 64KB chunks
                    while chunk := f.read(65536):
                        self.wfile.write(chunk)

        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            self.send_error(500, f"Streaming Error: {e}")

    def log_message(self, format, *args):
        # Clean terminal output
        pass

def main():
    print("=" * 60)
    print("RKNEc Central Library Question Papers Portal")
    print("=" * 60)
    print(f"Local URL:   http://localhost:{PORT}")
    print(f"Network URL: http://192.168.1.3:{PORT}")
    print(f"Indexed:     12,742 papers ready for exploration")
    print("=" * 60)

    server = ThreadingHTTPServer(("0.0.0.0", PORT), ArchiveHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down portal server.")
        server.server_close()

if __name__ == "__main__":
    main()
