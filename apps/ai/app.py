import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def _configure_logging():
    fmt = "%(asctime)s %(levelname)-8s %(name)s | %(message)s"
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(fmt, datefmt="%H:%M:%S"))
    # Root logger at WARNING — only our app loggers at INFO
    root = logging.getLogger()
    root.setLevel(logging.WARNING)
    for name in ("image_gen", "rag", "embeddings", "brand_kit", "llm", "agents"):
        log = logging.getLogger(name)
        log.setLevel(logging.INFO)
        if not log.handlers:   # prevent duplicate handlers on uvicorn reload
            log.addHandler(handler)
        log.propagate = False


def create_app(lifespan=None) -> FastAPI:
    _configure_logging()
    app = FastAPI(
        title="AI Platform",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app