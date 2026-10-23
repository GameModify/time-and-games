@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Требуется Node.js 24 LTS или новее: https://nodejs.org/
  pause
  exit /b 1
)
node -e "if (+process.versions.node.split('.')[0] < 24) process.exit(1)"
if errorlevel 1 (
  echo Обновите Node.js до версии 24 LTS или новее.
  pause
  exit /b 1
)
rem TLS 1.2 works with local network filters that interrupt TLS 1.3.
set "NODE_OPTIONS=%NODE_OPTIONS% --tls-max-v1.2"
if not exist "node_modules" (
  echo [Time ^& Games] Установка зависимостей...
  node scripts\npm.mjs ci
  if errorlevel 1 goto fail
)
echo [Time ^& Games] Сборка актуального интерфейса...
node scripts\npm.mjs run build
if errorlevel 1 goto fail
echo [Time ^& Games] Запуск: http://127.0.0.1:3535
start "" "http://127.0.0.1:3535"
node server\index.mjs
if errorlevel 1 goto fail
goto :eof
:fail
echo Ошибка запуска. Проверьте сообщение выше.
pause
