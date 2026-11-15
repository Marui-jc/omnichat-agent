@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem Local runner: this machine has no global node/npm, so borrow the DSH runtime's node.
rem Run this from a normal terminal: a few tests spawn child processes or create temp
rem directories inside the repo, which a sandboxed agent session may refuse.
set "DSH_NODE_BIN=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin"
if exist "%DSH_NODE_BIN%\node.exe" set "PATH=%DSH_NODE_BIN%;%PATH%"
rem Local ffmpeg/ffprobe (downloaded under .tools\ffmpeg): voice volume and normalization.
set "FFMPEG_BIN=%~dp0..\.tools\ffmpeg"
if exist "%FFMPEG_BIN%\ffmpeg.exe" set "PATH=%FFMPEG_BIN%;%PATH%"

rem Local copy of the installed DSH tool packages (extracted from app.asar) for tool-name reconciliation.
if exist "%~dp0..\.tools\dsh-packages\@deepseek-ai" set "DSH_TOOL_PACKAGES=%~dp0..\.tools\dsh-packages\@deepseek-ai"


where node >nul 2>nul
if errorlevel 1 (
    echo [%date% %time%] node not found: install Node 22.13+ or fix DSH_NODE_BIN.
    pause
    exit /b 1
)

node scripts\test-audit.mjs %*
set code=%errorlevel%
echo.
echo test:audit exit code = %code%
pause
exit /b %code%
