@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem LARP_BEHIND_CF=1: серверу можно верить заголовку CF-Connecting-IP (запросы идут через локальный cloudflared)
rem set LARP_ADMIN_CODE=придумайте-длинный-секретный-код   (по нему первый пользователь получает роль админа, не короче 12 символов)
set LARP_BEHIND_CF=1
start "LarpQuizov" cmd /k dotnet run
timeout /t 8 >nul
echo Ссылка вида https://xxxx.trycloudflare.com появится ниже:
cloudflared tunnel --url http://localhost:5000
