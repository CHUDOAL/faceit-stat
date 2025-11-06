# Настройка Git и загрузка на GitHub

## Шаг 1: Создайте репозиторий на GitHub

1. Зайдите на [github.com](https://github.com)
2. Нажмите "New" (или "+" → "New repository")
3. Заполните:
   - **Repository name**: `faceit-elo-widget` (или любое другое)
   - **Description**: `Faceit ELO Widget for OBS with authentication`
   - **Visibility**: Private (рекомендуется) или Public
   - **НЕ** добавляйте README, .gitignore или лицензию (они уже есть)
4. Нажмите "Create repository"

## Шаг 2: Подключите локальный репозиторий к GitHub

После создания репозитория GitHub покажет инструкции. Выполните:

```bash
cd "E:\Teiria python"
git remote add origin https://github.com/ВАШ_USERNAME/faceit-elo-widget.git
git push -u origin main
```

**Или если используете SSH:**

```bash
git remote add origin git@github.com:ВАШ_USERNAME/faceit-elo-widget.git
git push -u origin main
```

## Шаг 3: Проверка

После успешного push зайдите на GitHub и проверьте, что все файлы загружены.

---

## Альтернатива: Через GitHub Desktop

1. Установите [GitHub Desktop](https://desktop.github.com/)
2. Откройте GitHub Desktop
3. File → Add Local Repository
4. Выберите папку `E:\Teiria python`
5. Publish repository → Выберите имя и видимость
6. Нажмите "Publish repository"

---

## Важно!

⚠️ **НЕ коммитьте пароли и токены!**

Убедитесь, что в `.gitignore` есть:
- `.env`
- `*.log`
- Локальные настройки

Если случайно закоммитили пароль:
1. Измените пароль в переменных окружения на сервере
2. Удалите файл из истории Git (если нужно)

---

## Обновление репозитория

После изменений:

```bash
cd "E:\Teiria python"
git add .
git commit -m "Описание изменений"
git push
```

