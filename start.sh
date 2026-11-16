#!/bin/sh
cd "$(dirname "$0")"
# export LARP_ADMIN_CODE="придумайте-длинный-секретный-код"   # по нему первый пользователь получает роль админа (в профиле: «Код администратора»); не короче 12 символов
export LARP_BEHIND_CF=1   # верим CF-Connecting-IP только от локального cloudflared
dotnet run & sleep 8
cloudflared tunnel --url http://localhost:5000
