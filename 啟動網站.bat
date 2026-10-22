@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 第一次使用，安裝套件中...
  call npm install
)
start "" http://127.0.0.1:5200/
call npm run dev
