import http.server
import socketserver
import os
import urllib.parse

class SentinelRequestHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        '': 'application/octet-stream',
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.mjs': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.webp': 'image/webp',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def translate_path(self, path):
        # Resolve filesystem path
        resolved = super().translate_path(path)
        clean_path = resolved.rstrip('/\\')

        # 1. Directory routing: check if directory has index.html or dashboard/index.html
        if os.path.isdir(resolved):
            idx = os.path.join(resolved, 'index.html')
            if os.path.exists(idx):
                return idx
            dash_idx = os.path.join(resolved, 'dashboard', 'index.html')
            if os.path.exists(dash_idx):
                return dash_idx

        if os.path.isdir(clean_path):
            idx = os.path.join(clean_path, 'index.html')
            if os.path.exists(idx):
                return idx
            dash_idx = os.path.join(clean_path, 'dashboard', 'index.html')
            if os.path.exists(dash_idx):
                return dash_idx

        # 2. File / Clean URL routing: check with .html extension
        if not os.path.exists(resolved):
            if os.path.exists(clean_path + '.html'):
                return clean_path + '.html'
            if os.path.exists(resolved + '.html'):
                return resolved + '.html'
            if os.path.isdir(clean_path):
                idx = os.path.join(clean_path, 'index.html')
                if os.path.exists(idx):
                    return idx

        return resolved

    def list_directory(self, path):
        # Prevent raw directory listings; redirect or 404
        index_candidate = os.path.join(path, 'index.html')
        if os.path.exists(index_candidate):
            return self.send_head()
        dash_candidate = os.path.join(path, 'dashboard', 'index.html')
        if os.path.exists(dash_candidate):
            self.send_response(302)
            self.send_header('Location', '/user/dashboard/index.html' if 'user' in path else '/guardian/dashboard/index.html')
            self.end_headers()
            return None
        self.send_error(404, "File not found")
        return None

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)
    port = 8000
    
    # Ensure port reuse
    socketserver.TCPServer.allow_reuse_address = True
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    
    server_address = ('', port)
    httpd = http.server.ThreadingHTTPServer(server_address, SentinelRequestHandler)
    httpd.daemon_threads = True
    print("=" * 60)
    print(f"Guardian AI Sentinel running at http://localhost:{port}")
    print(f"  • Landing Page:        http://localhost:{port}/")
    print(f"  • 30-Feature Hub:      http://localhost:{port}/hub.html")
    print(f"  • User Dashboard:      http://localhost:{port}/user/dashboard/index.html")
    print(f"  • Guardian Dashboard:  http://localhost:{port}/guardian/dashboard/index.html")
    print(f"  • Account Sign In:     http://localhost:{port}/login.html")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

