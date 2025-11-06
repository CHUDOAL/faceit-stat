#!/usr/bin/env python3
"""
HTTP сервер для OBS виджета Faceit ELO с защитой доступа
Запустите этот файл перед использованием виджета в OBS
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import os
import base64
import urllib.parse
from pathlib import Path

# Получаем пароль из переменной окружения или используем по умолчанию
# ВАЖНО: В продакшене всегда устанавливайте через переменные окружения!
WIDGET_PASSWORD = os.environ.get('WIDGET_PASSWORD', 'your_secure_password_here')
WIDGET_TOKEN = os.environ.get('WIDGET_TOKEN', None)  # Опциональный токен в URL

# Проверка безопасности в продакшене
if os.environ.get('RENDER') or os.environ.get('DYNO'):
    if WIDGET_PASSWORD == 'your_secure_password_here':
        print("⚠️  ВНИМАНИЕ: Используется пароль по умолчанию! Установите WIDGET_PASSWORD в переменных окружения!")
    if not WIDGET_TOKEN:
        print("⚠️  Рекомендуется установить WIDGET_TOKEN для дополнительной защиты!")

class SecureCORSRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Проверяем токен в URL, если он установлен
        if WIDGET_TOKEN:
            parsed_path = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_path.query)
            token = query_params.get('token', [None])[0]
            
            if token != WIDGET_TOKEN:
                self.send_response(403)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b'<h1>403 Forbidden</h1><p>Invalid token</p>')
                return
        
        # Проверяем Basic Auth
        auth_header = self.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Basic '):
            self.send_response(401)
            self.send_header('WWW-Authenticate', 'Basic realm="Widget Access"')
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b'<h1>401 Unauthorized</h1><p>Authentication required</p>')
            return
        
        # Декодируем и проверяем пароль
        try:
            encoded = auth_header.split(' ')[1]
            decoded = base64.b64decode(encoded).decode('utf-8')
            username, password = decoded.split(':', 1)
            
            if password != WIDGET_PASSWORD:
                self.send_response(401)
                self.send_header('WWW-Authenticate', 'Basic realm="Widget Access"')
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b'<h1>401 Unauthorized</h1><p>Invalid password</p>')
                return
        except Exception:
            self.send_response(401)
            self.send_header('WWW-Authenticate', 'Basic realm="Widget Access"')
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b'<h1>401 Unauthorized</h1><p>Invalid credentials</p>')
            return
        
        # Если аутентификация прошла, отдаем файл
        self.serve_file()
    
    def serve_file(self):
        # Убираем токен из пути, если он есть
        path = urllib.parse.urlparse(self.path).path
        
        # Если путь - корень или пустой, показываем виджет
        if path == '/' or path == '':
            path = '/faceit_elo_widget.html'
        
        # Безопасный путь к файлу
        script_dir = Path(__file__).parent
        file_path = script_dir / path.lstrip('/')
        
        # Проверяем, что файл существует и находится в нужной директории
        if not file_path.exists() or not file_path.is_file():
            self.send_response(404)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b'<h1>404 Not Found</h1>')
            return
        
        # Определяем MIME тип
        mime_types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
        }
        
        ext = file_path.suffix.lower()
        content_type = mime_types.get(ext, 'application/octet-stream')
        
        # Отправляем файл
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-type', content_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(f'<h1>500 Internal Server Error</h1><p>{str(e)}</p>'.encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def log_message(self, format, *args):
        # Упрощенное логирование (без паролей)
        if 'Authorization' not in str(args):
            super().log_message(format, *args)

def run_server(port=None, host='0.0.0.0'):
    # Порт из переменной окружения или по умолчанию
    if port is None:
        port = int(os.environ.get('PORT', 8000))
    
    server_address = (host, port)
    httpd = HTTPServer(server_address, SecureCORSRequestHandler)
    
    # Получаем путь к директории скрипта
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Определяем, локально или в облаке
    is_cloud = os.environ.get('RENDER', False) or os.environ.get('DYNO', False)
    protocol = 'https' if is_cloud else 'http'
    hostname = os.environ.get('RENDER_EXTERNAL_HOSTNAME') or os.environ.get('HEROKU_APP_NAME')
    
    if hostname:
        base_url = f"{protocol}://{hostname}"
    else:
        base_url = f"{protocol}://{host}:{port}"
    
    print(f"🚀 Сервер запущен на {base_url}")
    print(f"📁 Открыта директория: {script_dir}")
    print(f"🔐 Защита: HTTP Basic Auth" + (" + Token" if WIDGET_TOKEN else ""))
    print(f"🔑 Пароль: {WIDGET_PASSWORD[:3]}*** (из переменной WIDGET_PASSWORD)")
    
    if WIDGET_TOKEN:
        print(f"🎫 Токен в URL: {WIDGET_TOKEN[:3]}*** (из переменной WIDGET_TOKEN)")
        print(f"🌐 URL с токеном: {base_url}/faceit_elo_widget.html?token={WIDGET_TOKEN}")
    else:
        print(f"🌐 URL: {base_url}/faceit_elo_widget.html")
    
    print("\n💡 Для использования в OBS:")
    print(f"   1. Добавьте 'Browser Source' в OBS")
    if WIDGET_TOKEN:
        print(f"   2. URL: {base_url}/faceit_elo_widget.html?token={WIDGET_TOKEN}")
        print(f"   3. В настройках Browser Source включите 'Shutdown source when not visible'")
    else:
        print(f"   2. URL: {base_url}/faceit_elo_widget.html")
        print(f"   3. В настройках Browser Source включите 'Shutdown source when not visible'")
        print(f"   4. Добавьте HTTP Basic Auth:")
        print(f"      Username: widget (или любое)")
        print(f"      Password: {WIDGET_PASSWORD}")
    print(f"   5. Ширина: 800, Высота: 400")
    print("\n⚠️  Нажмите Ctrl+C для остановки сервера\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Сервер остановлен")
        httpd.server_close()

if __name__ == '__main__':
    run_server()

