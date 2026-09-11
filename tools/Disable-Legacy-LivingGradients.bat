@echo off
:: Living Gradients - Legacy Cleaner
:: Elevates automatically if not already running as Administrator

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ===================================================================
echo  Living Gradients: Disabling Legacy v2.0.0 Common Files Extension
echo ===================================================================
echo.

set "TARGET=C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\LivingGradients"
set "BACKUP=C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\LivingGradients.v2.0.0.disabled"

if exist "%TARGET%" (
    if exist "%BACKUP%" (
        echo Removing previous backup...
        rmdir /s /q "%BACKUP%"
    )
    ren "%TARGET%" "LivingGradients.v2.0.0.disabled"
    if exist "%BACKUP%" (
        echo [SUCCESS] Successfully disabled legacy folder:
        echo           %TARGET%
        echo       ---^> %BACKUP%
    ) else (
        echo [ERROR] Could not rename folder. Please check file locks.
    )
) else (
    echo [INFO] Legacy folder not found or already disabled:
    echo        %TARGET%
)

echo.
echo [DONE] Living Gradients v2.2.0 in AppData is now the active version in After Effects!
echo.
pause
