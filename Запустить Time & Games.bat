@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Требуется Node.js 24.12 LTS или новее: https://nodejs.org/
  pause
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number); if (major < 24 || (major === 24 && minor < 12)) process.exit(1)"
if errorlevel 1 (
  echo Обновите Node.js до версии 24 LTS или новее.
  pause
  exit /b 1
)
rem TLS 1.2 works with local network filters that interrupt TLS 1.3.
set "NODE_OPTIONS=%NODE_OPTIONS% --tls-max-v1.2"
if not exist "node_modules" (
  echo [Time ^& Games] Установка зависимостей...
  if exist "release.json" (
    node scripts\npm.ts ci --omit=dev
  ) else (
    node scripts\npm.ts ci
  )
  if errorlevel 1 goto fail
)
if not exist "release.json" (
  echo [Time ^& Games] Сборка актуального интерфейса...
  node scripts\npm.ts run build
  if errorlevel 1 goto fail
)
echo [Time ^& Games] Запуск: http://127.0.0.1:3535
if not "%TNG_NO_BROWSER%"=="1" start "" "http://127.0.0.1:3535"
node server\index.ts
if errorlevel 1 goto fail
goto :eof
:fail
echo Ошибка запуска. Проверьте сообщение выше.
pause
