@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem -- Local adaptation (not upstream logic) -------------------------------
rem 1) This machine has no global node (DSH desktop ships its own runtime).
rem    Put the DSH node directory first on PATH. A machine with Node 22.13+
rem    installed simply skips this block.
set "DSH_NODE_BIN=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin"
if exist "%DSH_NODE_BIN%\node.exe" set "PATH=%DSH_NODE_BIN%;%PATH%"
rem Local ffmpeg/ffprobe (downloaded under .tools\ffmpeg): voice volume and normalization.
set "FFMPEG_BIN=%~dp0..\.tools\ffmpeg"
if exist "%FFMPEG_BIN%\ffmpeg.exe" set "PATH=%FFMPEG_BIN%;%PATH%"

rem F5-TTS (python) needs a writable TEMP, a numba cache dir, and shared FFmpeg DLLs for torchcodec.
set "TTS_TMP=%~dp0state\tmp"
if not exist "%TTS_TMP%" mkdir "%TTS_TMP%"
set "TEMP=%TTS_TMP%"
set "TMP=%TTS_TMP%"
set "NUMBA_CACHE_DIR=%TTS_TMP%\numba"
set "WANDB_MODE=disabled"
set "FFMPEG_SHARED=%~dp0..\.tools\ffmpeg-shared\bin"
if exist "%FFMPEG_SHARED%\avcodec-61.dll" set "PATH=%FFMPEG_SHARED%;%PATH%"


where node >nul 2>nul
if errorlevel 1 (
    echo [%date% %time%] node not found: install Node 22.13+ or fix DSH_NODE_BIN.
    pause
    exit /b 1
)

rem Harden state/ ACLs (Windows needs WRITE_DAC; the directory owner normally
rem has it, so no UAC prompt in the usual case). This NEVER blocks startup: if
rem it cannot get permission it prints a copy-pasteable command and exits 0.
rem See docs/guides/SECURITY_BASELINE.md ("secrets at rest").
node scripts\harden-state-acl.mjs --quiet

:loop
rem 2) Desktop DSH picks a random port on every start, so a stale dsh.baseUrl
rem    also breaks the auth Cookie authority. Sync before each start (fast probe).
node scripts\dsh-port-sync.mjs
node src/bridge.js
set code=%errorlevel%
if "%code%"=="2" (
    echo [%date% %time%] bridge already running in another window. Exiting.
    pause
    exit /b 2
)
echo [%date% %time%] bridge exited (code %code%), restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
