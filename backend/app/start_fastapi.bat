@echo off
echo Starting Project Drishti FastAPI Backend...
cd %~dp0
python -m uvicorn fastapi_app:app --reload --host 0.0.0.0 --port 8000
pause