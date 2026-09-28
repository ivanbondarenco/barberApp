@echo off
title BarberApp - servidor
cd /d "%~dp0.."

if not exist node_modules (
  echo Instalando dependencias...
  call npm install || goto :error
)

rem Abre el navegador cuando el servidor ya esta escuchando
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "while ($true) { try { (New-Object Net.Sockets.TcpClient 'localhost', 3001).Close(); break } catch { Start-Sleep 1 } }; Start-Process 'http://localhost:3001'"

call npm run dev -- -p 3001
goto :eof

:error
echo.
echo Hubo un error. Revisa los mensajes de arriba.
pause
