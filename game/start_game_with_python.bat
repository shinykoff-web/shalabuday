@echo off
chcp 65001
title JS GAME with Python
setlocal

set GAME_DIR=%USERPROFILE%\Desktop\gamev\game
set INDEX=%GAME_DIR%\index.html
set PORT=8000

:: Проверка index.html
if not exist "%INDEX%" (
    echo [ОШИБКА] index.html не найден
    pause
    exit /b
)

:: Проверка Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python не найден, установка...

    :: Скачиваем Python 3.12 (64-bit)
    powershell -Command "Invoke-WebRequest https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe -OutFile $env:TEMP\python_installer.exe"

    :: Тихая установка для всех пользователей, добавление в PATH
    start /wait "" "%TEMP%\python_installer.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0

    :: Проверка установки
    python --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Python не установлен
        pause
        exit /b
    )

    del "%TEMP%\python_installer.exe"
)

:: Переход в папку игры
cd /d "%GAME_DIR%"

:: Запуск локального сервера на Python
echo Запуск сервера...
start "PY SERVER" cmd /k python -m http.server %PORT%

timeout /t 2 >nul

:: Открытие браузера
start "" http://localhost:%PORT%

exit
