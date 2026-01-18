@echo off
chcp 65001
title JS GAME (PY SERVER)
setlocal

set GAME_DIR=%USERPROFILE%\Desktop\gamev\game
set PORT=8000

if not exist "%GAME_DIR%\index.html" (
    echo [ОШИБКА] index.html не найден
    pause
    exit /b
)

echo Переход в папку игры
cd /d "%GAME_DIR%" || (
    echo [ОШИБКА] Не удалось перейти в папку
    pause
    exit /b
)

echo Запуск Python-сервера...
start "PY SERVER" cmd /k python -m http.server %PORT%

timeout /t 2 >nul

echo Открытие браузера...
start "" http://localhost:%PORT%

exit
