#!/bin/bash
# Azure App Service startup script.
# Azure sets $PORT automatically; default to 8000 for local use.
set -e
cd /home/site/wwwroot/backend
pip install -r requirements.txt --quiet
exec uvicorn server:app --host 0.0.0.0 --port "${PORT:-8000}"
