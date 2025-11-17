import json, os, sys, tempfile, subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODULES_COMMON = ROOT / "modules" / "_common"
RUNNER = MODULES_COMMON / "main.py"
TIMEOUT_SEC = int(os.getenv("CERPER_EVAL_TIMEOUT_SEC", "20"))

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/run-eval":
            self._send_json(404, {"ok": False, "error": "not_found"})
            return

        api_key = os.getenv("CERPER_EVAL_API_KEY")
        if api_key:
            if self.headers.get("X-API-Key") != api_key:
                self._send_json(403, {"ok": False, "error": "invalid_api_key"})
                return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
        except Exception as e:
            self._send_json(400, {"ok": False, "error": f"invalid_json: {e}"})
            return

        if not RUNNER.is_file():
            self._send_json(500, {"ok": False, "error": "runner_not_found"})
            return

        try:
            with tempfile.TemporaryDirectory(prefix="cerper_eval_") as tmpdir:
                tmp = Path(tmpdir) / "eval.json"
                tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

                proc = subprocess.run(
                    [sys.executable, str(RUNNER), str(tmp)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=TIMEOUT_SEC,
                )

                if proc.returncode != 0:
                    self._send_json(
                        500,
                        {"ok": False, "error": "runner_error", "stderr": proc.stderr},
                    )
                    return

                out = proc.stdout.strip() or "[]"
                try:
                    parsed = json.loads(out)
                except Exception as e:
                    self._send_json(
                        500,
                        {"ok": False, "error": f"invalid_runner_output: {e}", "raw": out},
                    )
                    return

                self._send_json(200, parsed)
        except subprocess.TimeoutExpired:
            self._send_json(504, {"ok": False, "error": "runner_timeout"})
        except Exception as e:
            self._send_json(500, {"ok": False, "error": f"server_error: {e}"})

def main():
    host = os.getenv("CERPER_EVAL_HOST", "0.0.0.0")
    port = int(os.getenv("CERPER_EVAL_PORT", "8000"))
    httpd = HTTPServer((host, port), Handler)
    print(f"[EVAL-SERVICE] Listening on {host}:{port}", flush=True)
    httpd.serve_forever()

if __name__ == "__main__":
    main()
