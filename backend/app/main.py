import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router
from app.core.config import settings

# Surface INFO logs from our own modules (sourcer / enrichment / dropcontact)
# so we can audit a run end-to-end. Uvicorn installs handlers on its own
# loggers but NOT on root, so app.* messages with no handler go nowhere —
# we add a dedicated StreamHandler and disable propagation to avoid dupes.
_app_logger = logging.getLogger("app")
_app_logger.setLevel(logging.INFO)
if not _app_logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    _app_logger.addHandler(_handler)
    _app_logger.propagate = False

app = FastAPI(title="Fabienne API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
