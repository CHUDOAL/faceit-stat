# Развертывание виджета на облачном хостинге

Это руководство поможет вам развернуть виджет на облачном хостинге (например, Render.com) с защитой доступа.

## Варианты развертывания

### 1. Render.com (Рекомендуется - бесплатный план)

#### Шаг 1: Подготовка

1. Создайте аккаунт на [Render.com](https://render.com)
2. Подготовьте репозиторий на GitHub (или используйте GitLab)

#### Шаг 2: Настройка на Render

1. Войдите в Render Dashboard
2. Нажмите "New +" → "Web Service"
3. Подключите ваш репозиторий
4. Настройте сервис:
   - **Name**: `faceit-widget` (или любое другое)
   - **Environment**: `Python 3`
   - **Build Command**: (оставьте пустым)
   - **Start Command**: `python server.py`

#### Шаг 3: Переменные окружения

В разделе "Environment" добавьте:

```
WIDGET_PASSWORD=ваш_секретный_пароль_здесь
WIDGET_TOKEN=ваш_секретный_токен_здесь (опционально)
PORT=8000
```

**Важно**: Используйте сложные пароли и токены!

#### Шаг 4: Деплой

1. Нажмите "Create Web Service"
2. Дождитесь завершения деплоя
3. Получите URL вида: `https://your-service.onrender.com`

#### Шаг 5: Использование в OBS

1. Откройте OBS → Добавьте "Browser Source"
2. URL: `https://your-service.onrender.com/faceit_elo_widget.html?token=ваш_секретный_токен`
3. В настройках Browser Source:
   - Ширина: `800`
   - Высота: `400`
   - Включите "Shutdown source when not visible"
   - Если используете Basic Auth (без токена):
     - Username: `widget` (или любое)
     - Password: `ваш_секретный_пароль`

---

### 2. Heroku

#### Шаг 1: Установка Heroku CLI

```bash
# Windows
winget install Heroku.HerokuCLI

# Или скачайте с https://devcenter.heroku.com/articles/heroku-cli
```

#### Шаг 2: Логин и создание приложения

```bash
heroku login
heroku create your-widget-name
```

#### Шаг 3: Установка переменных окружения

```bash
heroku config:set WIDGET_PASSWORD=ваш_секретный_пароль
heroku config:set WIDGET_TOKEN=ваш_секретный_токен
```

#### Шаг 4: Деплой

```bash
git push heroku main
```

#### Шаг 5: Использование

URL будет: `https://your-widget-name.herokuapp.com`

---

### 3. PythonAnywhere

#### Шаг 1: Создайте аккаунт

1. Зарегистрируйтесь на [PythonAnywhere.com](https://www.pythonanywhere.com)
2. Создайте бесплатный аккаунт

#### Шаг 2: Загрузите файлы

1. Загрузите все файлы через веб-интерфейс или Git
2. Убедитесь, что `server.py` находится в корне

#### Шаг 3: Настройте Web App

1. Перейдите в "Web" → "Add a new web app"
2. Выберите "Manual configuration" → Python 3.10
3. В "Source code" укажите путь к файлам
4. В "WSGI configuration file" добавьте:

```python
import sys
path = '/home/yourusername/path/to/widget'
if path not in sys.path:
    sys.path.insert(0, path)

from server import app
application = app
```

#### Шаг 4: Переменные окружения

В "Web" → "Environment variables" добавьте:
- `WIDGET_PASSWORD=ваш_секретный_пароль`
- `WIDGET_TOKEN=ваш_секретный_токен`

---

## Защита доступа

### Вариант 1: Токен в URL (Рекомендуется для OBS)

1. Установите `WIDGET_TOKEN` в переменных окружения
2. Используйте URL: `https://your-service.com/faceit_elo_widget.html?token=ваш_токен`
3. Только люди с правильным токеном смогут получить доступ

### Вариант 2: HTTP Basic Auth

1. Установите `WIDGET_PASSWORD` в переменных окружения
2. В OBS Browser Source добавьте:
   - Username: `widget` (или любое)
   - Password: `ваш_секретный_пароль`

### Вариант 3: Комбинация (Максимальная защита)

Используйте оба метода одновременно:
- Токен в URL
- HTTP Basic Auth

---

## Генерация безопасных паролей и токенов

### Windows PowerShell:

```powershell
# Генерация пароля
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Генерация токена
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

### Linux/Mac:

```bash
# Генерация пароля
openssl rand -base64 32

# Генерация токена
openssl rand -hex 32
```

### Онлайн генераторы:

- [Random.org](https://www.random.org/passwords/)
- [LastPass Password Generator](https://www.lastpass.com/features/password-generator)

---

## Проверка безопасности

После развертывания проверьте:

1. ✅ Виджет недоступен без токена/пароля
2. ✅ Виджет работает в OBS с правильными учетными данными
3. ✅ Переменные окружения установлены правильно
4. ✅ HTTPS включен (для Render и Heroku автоматически)

---

## Обновление виджета

### Render.com:

1. Сделайте изменения в коде
2. Закоммитьте и запушьте в GitHub
3. Render автоматически обновит сервис

### Heroku:

```bash
git add .
git commit -m "Update widget"
git push heroku main
```

---

## Устранение неполадок

### Виджет не загружается в OBS

1. Проверьте URL (должен быть HTTPS)
2. Проверьте токен/пароль
3. Проверьте логи сервера в Render/Heroku Dashboard
4. Убедитесь, что сервер запущен

### Ошибка 401/403

1. Проверьте переменные окружения
2. Убедитесь, что токен/пароль правильные
3. Проверьте формат URL

### Виджет доступен всем

1. Проверьте, что переменные окружения установлены
2. Убедитесь, что токен/пароль не пустые
3. Проверьте логи сервера

---

## Дополнительная безопасность

### Ограничение по IP (опционально)

Если нужно ограничить доступ по IP, добавьте в `server.py`:

```python
ALLOWED_IPS = ['your.ip.address.here']  # Ваш IP

# В do_GET добавить проверку:
client_ip = self.client_address[0]
if client_ip not in ALLOWED_IPS:
    self.send_response(403)
    ...
```

### Rate Limiting (опционально)

Для защиты от злоупотреблений можно добавить rate limiting через переменные окружения.

---

## Поддержка

Если возникли проблемы:
1. Проверьте логи сервера
2. Убедитесь, что все файлы загружены
3. Проверьте переменные окружения
4. Убедитесь, что порт правильный


