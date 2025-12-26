@echo off
REM Build script for PDF Report Generator
REM This creates a standalone executable that doesn't require Python installed

echo === Building PDF Report Generator ===
echo.

REM Check if PyInstaller is installed
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo Installing PyInstaller...
    pip install pyinstaller
)

REM Check if reportlab is installed
python -c "import reportlab" 2>nul
if errorlevel 1 (
    echo Installing reportlab...
    pip install reportlab Pillow
)

echo.
echo Building executable...

REM Build the executable using python -m to avoid PATH issues
python -m PyInstaller ^
    --onefile ^
    --name report_generator ^
    --distpath "modules\python\reports\dist" ^
    --workpath "modules\python\reports\build" ^
    --specpath "modules\python\reports" ^
    --clean ^
    --noconfirm ^
    modules\python\reports\report_generator.py

echo.
if exist "modules\python\reports\dist\report_generator.exe" (
    echo === BUILD SUCCESSFUL ===
    echo Executable created at: modules\python\reports\dist\report_generator.exe
    echo.
    echo You can now distribute the app without requiring Python on client machines.
) else (
    echo === BUILD FAILED ===
    echo Check the output above for errors.
)

echo.
pause
