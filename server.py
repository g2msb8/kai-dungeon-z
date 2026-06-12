"""開発用 HTTP サーバー。
 - Cache-Control: no-cache ヘッダー全ファイルに付加
 - index.html の <script type="module" src="src/main.js"> を
   src="src/main.js?v=TIMESTAMP" に書き換えて返す
 - 全 .js ファイルのローカル import パスにも ?v=TIMESTAMP を付与
   → Chromium の ESM モジュールキャッシュをチェーン全体でバイパス
"""
import http.server, socketserver, sys, time, re, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
V    = str(int(time.time()))   # 起動時のタイムスタンプ

# ローカル相対 import の URL にバージョンスタンプを付与する正規表現
_IMPORT_RE = re.compile(rb"""(from\s+['"])(\.[^'"]+\.js)(\?[^'"]*)?(['"])""")

def _patch_js(raw: bytes) -> bytes:
    """JS ソース中のローカル import パスに ?v=V を付与する"""
    v = V.encode()
    def _replace(m):
        return m.group(1) + m.group(2) + b'?v=' + v + m.group(4)
    return _IMPORT_RE.sub(_replace, raw)

class DevHandler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma',  'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        # index.html: script src に ?v=V を挿入
        if self.path in ('/', '/index.html', '/?'):
            try:
                with open('index.html', 'rb') as f:
                    raw = f.read()
                patched = re.sub(
                    rb'src="src/main\.js(?:\?v=\d+)?"',
                    f'src="src/main.js?v={V}"'.encode(),
                    raw
                )
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(patched)))
                self.end_headers()
                self.wfile.write(patched)
            except Exception as e:
                self.send_error(500, str(e))
            return

        # .js ファイル: ローカル import に ?v=V を付与してキャッシュバスト
        clean = self.path.split('?')[0].lstrip('/')
        if clean.endswith('.js'):
            try:
                with open(clean, 'rb') as f:
                    raw = f.read()
                patched = _patch_js(raw)
                self.send_response(200)
                self.send_header('Content-Type', 'application/javascript; charset=utf-8')
                self.send_header('Content-Length', str(len(patched)))
                self.end_headers()
                self.wfile.write(patched)
            except FileNotFoundError:
                self.send_error(404, 'Not Found')
            except Exception as e:
                self.send_error(500, str(e))
            return

        super().do_GET()

    def log_message(self, fmt, *args):
        pass  # 静かに

with socketserver.TCPServer(('127.0.0.1', PORT), DevHandler) as httpd:
    print(f'[DungeonZ Dev Server] http://127.0.0.1:{PORT}  v={V}')
    httpd.serve_forever()
