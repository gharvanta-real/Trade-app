"""
main.py — Python REST Sidecar entry point.
Launches FastAPI with CORS and mounts the Kotak Neo router.
Run with:  .venv/Scripts/uvicorn main:app --port 8001 --reload
"""

import warnings
import logging
import sys

def custom_showwarning(message, category, filename, lineno, file=None, line=None):
    msg = str(message).lower()
    cat = str(category).lower()
    if "utcnow" in msg or "pandas4" in cat or "deprecation" in cat or "deprecation" in msg:
        return
    try:
        if file is None:
            file = sys.stderr
        if file is not None:
            file.write(warnings.formatwarning(message, category, filename, lineno, line))
    except Exception:
        pass

warnings.showwarning = custom_showwarning
warnings.filterwarnings("ignore")

class WarningFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage().lower()
        if "utcnow" in msg or "pandas4" in msg or "deprecation" in msg:
            return False
        return True

logging.getLogger("py.warnings").addFilter(WarningFilter())
logging.getLogger().addFilter(WarningFilter())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from router import router

app = FastAPI(
    title="Tradesk Kotak Neo Sidecar",
    description="REST bridge for Kotak Neo login, credentials, and order routing.",
    version="1.0.0",
)

# Allow the Vite dev server (port 5173) and any local origin to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "kotak-neo-sidecar"}
