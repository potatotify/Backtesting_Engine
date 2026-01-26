# Setup script for Windows PowerShell
# Creates virtual environment and installs dependencies

Write-Host "Setting up Python virtual environment..." -ForegroundColor Green

# Check if venv exists
if (Test-Path "venv") {
    Write-Host "Virtual environment already exists." -ForegroundColor Yellow
} else {
    # Create virtual environment
    python -m venv venv
    Write-Host "Virtual environment created." -ForegroundColor Green
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Green
& .\venv\Scripts\Activate.ps1

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Green
python -m pip install --upgrade pip

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
pip install -r requirements.txt

Write-Host "`nSetup complete! To start the server, run:" -ForegroundColor Green
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor Cyan
Write-Host "  uvicorn main:app --reload" -ForegroundColor Cyan
