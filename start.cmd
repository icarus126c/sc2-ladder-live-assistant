@echo off
chcp 65001 >nul
setlocal
title 星际2天梯直播助手
cd /d "%~dp0"
echo.
echo 星际2天梯直播助手
echo 请保持正在运行的助手窗口打开。
echo.
if not exist "%~dp0runtime\node.exe" (
  echo 未找到运行环境，请先完整解压ZIP，再启动此文件。
  echo 不要在压缩包中直接启动，也不要只复制启动器。
  pause
  exit /b 1
)
if not exist "%~dp0runtime\python\python.exe" (
  echo 未找到录像解析环境，请先完整解压ZIP。
  pause
  exit /b 1
)
if not exist "%~dp0ladder-server.cjs" (
  echo 程序文件不完整，请重新完整解压ZIP。
  pause
  exit /b 1
)
if not defined SC2_LADDER_PORT set "SC2_LADDER_PORT=17864"
echo 正在启动或打开已运行的助手……
echo 如果网页没有自动打开，请在浏览器输入：
echo http://127.0.0.1:%SC2_LADDER_PORT%/
echo.
"%~dp0runtime\node.exe" "%~dp0ladder-server.cjs" --open
set "SC2_LAUNCH_RESULT=%ERRORLEVEL%"
echo.
if not "%SC2_LAUNCH_RESULT%"=="0" (
  echo 启动未完成，请查看上方错误提示。
) else (
  echo 本次启动操作已结束；如果提示助手已在运行，可继续使用原窗口。
  echo 网页没打开时，请复制上方网址到浏览器。
)
echo 此窗口保留提示，按任意键关闭。
pause >nul
exit /b %SC2_LAUNCH_RESULT%
