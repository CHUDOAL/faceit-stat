# Данные для авторизации виджета

## HTTP Basic Auth - данные для входа

Когда вы видите форму авторизации на `https://faceit-stat.onrender.com`, используйте:

### Username (Имя пользователя):
```
widget
```
**Или любое другое имя** - сервер проверяет только пароль!

### Password (Пароль):
```
ваш_WIDGET_PASSWORD_из_Render
```
Это значение переменной окружения `WIDGET_PASSWORD`, которое вы установили в Render.

---

## Где найти пароль?

### В Render Dashboard:

1. Зайдите в ваш сервис на Render
2. Перейдите в раздел **"Environment"**
3. Найдите переменную **`WIDGET_PASSWORD`**
4. Скопируйте значение (или нажмите "Reveal" чтобы увидеть)

**Или:**

Если вы забыли пароль, сгенерируйте новый:

**Windows PowerShell:**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Linux/Mac:**
```bash
openssl rand -base64 32
```

Затем обновите переменную `WIDGET_PASSWORD` в Render.

---

## Использование в OBS

### Вариант 1: С токеном в URL (без авторизации)

Если вы установили `WIDGET_TOKEN` в Render, используйте:

```
URL: https://faceit-stat.onrender.com/faceit_elo_widget.html?token=ваш_токен
```

В этом случае форма авторизации не появится!

### Вариант 2: С HTTP Basic Auth

Если используете только пароль (без токена):

1. **URL**: `https://faceit-stat.onrender.com/faceit_elo_widget.html`

2. В настройках Browser Source:
   - **Username**: `widget` (или любое)
   - **Password**: `ваш_WIDGET_PASSWORD`

3. OBS автоматически добавит авторизацию в заголовки

---

## Пример

Если в Render установлено:
```
WIDGET_PASSWORD=dbP5m9vTcfJegZDqC6MRKykHSzhpFBiG
```

То для входа используйте:
- **Username**: `widget`
- **Password**: `dbP5m9vTcfJegZDqC6MRKykHSzhpFBiG`

---

## Если забыли пароль

1. Зайдите в Render Dashboard
2. Ваш сервис → "Environment"
3. Найдите `WIDGET_PASSWORD`
4. Нажмите "Reveal" чтобы увидеть значение
5. Или сгенерируйте новый и обновите переменную

---

## Безопасность

⚠️ **Важно:**
- Никогда не делитесь паролем
- Не коммитьте пароль в Git
- Используйте сложные пароли (минимум 32 символа)
- Регулярно обновляйте пароль

---

## Альтернатива: Использовать только токен

Чтобы избежать формы авторизации:

1. Установите `WIDGET_TOKEN` в Render
2. Используйте URL с токеном:
   ```
   https://faceit-stat.onrender.com/faceit_elo_widget.html?token=ваш_токен
   ```
3. Форма авторизации не появится


