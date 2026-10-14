#!/usr/bin/env python3
"""
Entry point to run the Smart PPE Vision Access Control Gateway.
"""
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

# Add virtual environment site-packages if running with system Python
root_dir = Path(__file__).resolve().parent
for venv_site in (root_dir / ".venv").glob("lib/python*/site-packages"):
    if str(venv_site) not in sys.path:
        sys.path.insert(0, str(venv_site))

import os
import uvicorn
from app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    is_prod = bool(os.environ.get("RENDER") or os.environ.get("PRODUCTION"))
    
    print(f"Starting Smart PPE Vision Access Control System on http://{host}:{port} (Prod: {is_prod})...")
    uvicorn.run("app:app", host=host, port=port, app_dir=str(backend_dir), reload=not is_prod)
