# Быстрое развертывание виджета на Render.com

## Шаг 1: Подготовка

1. Создайте репозиторий на GitHub с вашими файлами:
   - `server.py`
   - `faceit_elo_widget.html`
   - `faceit_widget.css`
   - `faceit_widget.js`
   - `requirements.txt`
   - `Procfile`
   - `render.yaml` (опционально)

2. Сгенерируйте безопасный пароль и токен:

**Windows PowerShell:**
```powershell
# Пароль (32 символа)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Токен (64 символа)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Linux/Mac:**
```bash
# Пароль
openssl rand -base64 32

# Токен
openssl rand -hex 32
```

## Шаг 2: Развертывание на Render

1. Зайдите на [render.com](https://render.com) и создайте аккаунт
2. Нажмите "New +" → "Web Service"
3. Подключите ваш GitHub репозиторий
4. Настройте:
   - **Name**: `faceit-widget` (или любое)
   - **Environment**: `Python 3`
   - **Build Command**: (оставьте пустым)
   - **Start Command**: `python server.py`

5. В разделе "Environment" добавьте переменные:
   ```
   WIDGET_PASSWORD=ваш_сгенерированный_пароль
   WIDGET_TOKEN=ваш_сгенерированный_токен
   PORT=8000
   ```

6. Нажмите "Create Web Service"

## Шаг 3: Использование в OBS

После деплоя вы получите URL вида: `https://your-service.onrender.com`

1. Откройте OBS → Добавьте "Browser Source"
2. URL: `https://your-service.onrender.com/faceit_elo_widget.html?token=ваш_токен`
3. Настройки:
   - Ширина: `800`
   - Высота: `400`
   - Включите "Shutdown source when not visible"

**Готово!** Теперь виджет доступен только вам через токен в URL.

---

## Альтернатива: Только пароль (без токена)

Если не хотите использовать токен:

1. Не устанавливайте `WIDGET_TOKEN` в переменных окружения
2. В OBS Browser Source:
   - URL: `https://your-service.onrender.com/faceit_elo_widget.html`
   - Включите "Custom CSS" → "Use custom CSS" (оставьте пустым)
   - В "Custom Headers" добавьте:
     ```
     Authorization: Basic base64(username:password)
     ```
   - Или используйте встроенную поддержку Basic Auth в OBS (если доступна)

---

## Обновление виджета

Просто запушьте изменения в GitHub - Render автоматически обновит сервис!

```bash
git add .
git commit -m "Update widget"
git push origin main
```

---

## Безопасность

✅ **Используйте сложные пароли и токены** (минимум 32 символа)
✅ **Никогда не коммитьте пароли/токены в Git**
✅ **Используйте переменные окружения**
✅ **Регулярно обновляйте пароли/токены**

---

## Устранение неполадок

**Виджет не загружается:**
- Проверьте URL (должен быть HTTPS)
- Проверьте токен в URL
- Проверьте логи в Render Dashboard

**Ошибка 403:**
- Проверьте, что токен правильный
- Убедитесь, что `WIDGET_TOKEN` установлен в переменных окружения

**Ошибка 401:**
- Проверьте пароль
- Убедитесь, что `WIDGET_PASSWORD` установлен


