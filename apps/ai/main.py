from datetime import datetime

from app import create_app
from routes import image_regen
from routes import chat, brand, analyst, reality_check

# New V1 agent routers
from agents.maya.routes import router as maya_router
from agents.rex.routes import router as rex_router
from agents.scout.routes import router as scout_router
from agents.sage.routes import router as sage_router
from agents.lex.routes import router as lex_router
from agents.vega.routes import router as vega_router
from agents.router import router as agent_router

app = create_app()

# ── Existing routes (keep untouched) ─────────────────────────────────────────
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(brand.router, prefix="/brand", tags=["Brand"])
app.include_router(analyst.router, prefix="/analyst", tags=["Analyst"])
app.include_router(image_regen.router, prefix="/image", tags=["Image"])
app.include_router(reality_check.router, prefix="/reality-check", tags=["Reality Check"])

# ── New V1 Veqiro AI Agent routes ─────────────────────────────────────────────
app.include_router(agent_router)   # /ai/router/classify
app.include_router(maya_router)    # /ai/maya/...
app.include_router(rex_router)     # /ai/rex/...
app.include_router(scout_router)   # /ai/scout/...
app.include_router(sage_router)    # /ai/sage/...
app.include_router(lex_router)     # /ai/lex/...
app.include_router(vega_router)    # /ai/vega/...


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
        "anthropic": True,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", reload=True)
