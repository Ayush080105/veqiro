from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends
from app import create_app
from core.auth import verify_internal_key
from core.conversation_memory import initialize_tables

# New V1 agent routers
from agents.maya.routes import router as maya_router
from agents.rex.routes import router as rex_router
from agents.scout.routes import router as scout_router
from agents.sage.routes import router as sage_router
from agents.lex.routes import router as lex_router
from agents.vega.routes import router as vega_router
from agents.router import router as agent_router
from briefing import router as briefing_router
from core.context_routes import router as context_router

@asynccontextmanager
async def lifespan(app):
    await initialize_tables()
    yield

app = create_app(lifespan=lifespan)


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
app.include_router(context_router,  dependencies=_auth)   # /ai/context/...


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
    uvicorn.run("api.main:app", reload=True)
