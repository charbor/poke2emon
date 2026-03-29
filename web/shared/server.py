#!/usr/bin/env python3
"""Local server for Pokedex apps with Claude API proxy."""
import http.server
import json
import urllib.request
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/identify':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))

            api_key = body.get('api_key', '')
            image_b64 = body.get('image', '')
            prompt = body.get('prompt', '')
            model = body.get('model', 'claude-sonnet-4-20250514')
            media_type = body.get('media_type', 'image/jpeg')

            payload = json.dumps({
                "model": model,
                "max_tokens": 300,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                        {"type": "text", "text": prompt}
                    ]
                }]
            }).encode()

            req = urllib.request.Request(
                'https://api.anthropic.com/v1/messages',
                data=payload,
                headers={
                    'Content-Type': 'application/json',
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                },
                method='POST'
            )

            try:
                with urllib.request.urlopen(req) as resp:
                    result = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result)
            except urllib.error.HTTPError as e:
                error_body = e.read().decode()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(error_body.encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": {"message": str(e)}}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        print(f"[pokedex] {args[0]}")

if __name__ == '__main__':
    server = http.server.HTTPServer(('', PORT), Handler)
    print(f"Pokedex server running at http://localhost:{PORT}")
    print(f"  Run from a region directory (e.g. web/denver/) to serve that region's files.")
    server.serve_forever()
