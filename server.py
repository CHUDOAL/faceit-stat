#!/usr/bin/env python3
"""
HTTP сервер для OBS виджета Faceit ELO с защитой доступа
Запустите этот файл перед использованием виджета в OBS
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import os
import urllib.parse
from pathlib import Path

# Авторизация теперь на клиенте через форму на сайте
# Логин: Mamix, Пароль: kiklol

class SecureCORSRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Убираем авторизацию - теперь она на клиенте
        # Просто отдаем файлы
        self.serve_file()
    
    def serve_file(self):
        # Убираем токен из пути, если он есть
        path = urllib.parse.urlparse(self.path).path
        
        # Если путь - корень или пустой, показываем страницу логина
        if path == '/' or path == '':
            path = '/login.html'
        
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
    print(f"🔐 Защита: Форма авторизации на сайте")
    print(f"👤 Логин: Mamix")
    print(f"🔑 Пароль: kiklol")
    print(f"🌐 URL: {base_url}/")
    print(f"🌐 URL виджета: {base_url}/faceit_elo_widget.html")
    
    print("\n💡 Для использования в OBS:")
    print(f"   1. Добавьте 'Browser Source' в OBS")
    print(f"   2. URL: {base_url}/faceit_elo_widget.html")
    print(f"   3. В настройках Browser Source включите 'Shutdown source when not visible'")
    print(f"   4. Ширина: 800, Высота: 400")
    print(f"\n⚠️  Примечание: Авторизация происходит через форму на сайте")
    print(f"   Логин: Mamix, Пароль: kiklol")
    print("\n⚠️  Нажмите Ctrl+C для остановки сервера\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Сервер остановлен")
        httpd.server_close()

if __name__ == '__main__':
    run_server()

