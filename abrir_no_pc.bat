@echo off
REM Abre o Caixa do Corre no navegador por um servidor local (necessario para o boneco 3D)
cd /d "%~dp0www"
start "" http://localhost:8080/index.html
where python >nul 2>nul && (python -m http.server 8080 & goto :eof)
where py >nul 2>nul && (py -m http.server 8080 & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p 8080 -c-1 & goto :eof)
echo Nao encontrei Python nem Node. Instale um deles ou use a extensao Live Server do VS Code.
pause
