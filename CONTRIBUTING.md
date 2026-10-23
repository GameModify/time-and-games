# Правила разработки Time & Games

Выполняем работу **в папке** `%USERPROFILE%\Desktop\Мой сайт`; основная ветка — `main`.

## Ветки и коммиты

- Каждая законченная задача разрабатывается в отдельной ветке от `main`: `feat/*`, `fix/*`, `refactor/*`, `docs/*`, `chore/*`.
- Коммиты называются по Conventional Commits: `feat(timeline): add overlapping sessions`, `fix(timer): stop session`, `docs: update setup guide`.
- Один коммит может охватывать несколько промежуточных микроизменений; не нужно коммитить каждую правку строки.
- Не делаем прямые feature-коммиты в `main`. Создаём PR, описываем поведение и проверки; после merge удаляем ветку.
- Для обычных PR используем **Squash and merge**, чтобы история `main` была читабельной. Ветка `main` должна проходить CI.

## Когда запускать тесты

**Не запускать полный набор после каждого микроизменения.** По ходу задачи допустимы быстрые локальные/точечные проверки. Когда фича или исправление полностью готово, **до завершающего коммита и PR** выполняем:

```powershell
npm run check
npm run build
npm test
```

Для изменений интерфейса — ручная проверка в браузере, для изменения API — подходящие проверочные запросы. GitHub Actions запускается на **PR в main** и на **изменениях main**, а не на каждом push в незавершённую feature-ветку.

## Конфиденциальность и данные

Не коммитить `data/` (SQLite, WAL, JSON-экспорты), `.env`, токены Steam/API, `node_modules/`, `dist/`, логи или личные данные. Проверить `git status` и `git diff --cached` перед push. Никаких секретов в сообщениях коммитов и PR.

## Branch protection

Желательная настройка для `main` в GitHub Settings → Rules → Rulesets: **Require pull request**, **Require status checks (verify / Build, lint and tests)**, **Block force pushes**, **Block deletions**. На некоторых тарифах GitHub правила private repo могут быть ограничены. Текстовые правила и CI работают независимо, но сами по себе не блокируют прямой push.
