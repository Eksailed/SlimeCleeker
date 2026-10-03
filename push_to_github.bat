@echo off
chcp 65001 > nul
echo [Pushing to GitHub...]
"C:\Users\schas\AppData\Local\Programs\MinGit\cmd\git.exe" push -u origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Код успешно отправлен на GitHub!
) else (
    echo.
    echo [NOTE] Если репозиторий еще не создан, создайте его на https://github.com/new
)
pause
