"""WatanyBot KB & Cases API — FastAPI entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.kb import router as kb_router
from .routers.cases import router as cases_router
from .routers.faq import router as faq_router

app = FastAPI(
    title="WatanyBot KB API",
    description="Knowledge Base and User Cases API for WatanyBot",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(kb_router)
app.include_router(cases_router)
app.include_router(faq_router)

@app.get("/health")
def health():
    return {"status": "ok"}
