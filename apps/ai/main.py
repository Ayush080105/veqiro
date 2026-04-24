from datetime import datetime
from pathlib import Path

from fastapi import Depends
from fastapi.staticfiles import StaticFiles
from app import create_app
from core.auth import verify_internal_key

# New V1 agent routers
from agents.maya.routes import router as maya_router
from agents.rex.routes import router as rex_router
from agents.scout.routes import router as scout_router
from agents.sage.routes import router as sage_router
from agents.lex.routes import router as lex_router
from agents.vega.routes import router as vega_router
from agents.router import router as agent_router
from briefing import router as briefing_router

app = create_app()

_LOCAL_STORAGE = Path(__file__).parent / "local_storage"
_LOCAL_STORAGE.mkdir(exist_ok=True)
((_LOCAL_STORAGE / "images")).mkdir(exist_ok=True)
((_LOCAL_STORAGE / "drafts")).mkdir(exist_ok=True)
app.mount("/files", StaticFiles(directory=str(_LOCAL_STORAGE)), name="files")

_auth = [Depends(verify_internal_key)]

# ── New V1 Veqiro AI Agent routes ─────────────────────────────────────────────
app.include_router(agent_router,  dependencies=_auth)   # /ai/router/classify
app.include_router(maya_router,   dependencies=_auth)   # /ai/maya/...
app.include_router(rex_router,    dependencies=_auth)   # /ai/rex/...
app.include_router(scout_router,  dependencies=_auth)   # /ai/scout/...
app.include_router(sage_router,   dependencies=_auth)   # /ai/sage/...
app.include_router(lex_router,    dependencies=_auth)   # /ai/lex/...
app.include_router(vega_router,     dependencies=_auth)   # /ai/vega/...
app.include_router(briefing_router, dependencies=_auth)   # /ai/briefing


# ── Health endpoints ──────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/ready", tags=["Health"])
async def ready():
    return {
        "db": True,
        "redis": True,
        "gemini": True,
        "openai": True,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", reload=True)
