import os
import structlog
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from middleware import RequestIDMiddleware, LoggingMiddleware, RateLimitMiddleware
from routers import public, admin, superadmin
from routers import whatsapp
from routers import whatsapp_sim
from routers import kb_v3
from routers import kb_v2

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer() if settings.log_json else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = structlog.get_logger()
    cwd = Path.cwd().resolve()
    cwd_parts = {part.lower() for part in cwd.parts}
    if "public-salaries-app" in cwd_parts or "_quarantine" in cwd_parts:
        raise RuntimeError("STOP: You are in a detached folder. Run from the repo root.")
    file_parents = Path(__file__).resolve().parents
    backend_root = file_parents[2] if len(file_parents) > 2 else file_parents[0]
    workspace_root = file_parents[4] if len(file_parents) > 4 else backend_root
    allowed = {
        workspace_root.resolve(),
        backend_root.resolve(),
        (backend_root / "apps" / "api").resolve(),
    }
    if cwd not in allowed:
        raise RuntimeError("STOP: Wrong working directory. Run from the workspace root, apps/api-backend, or apps/api-backend/apps/api.")
    settings.validate_secrets()
    
    # Resolve KB path with dev fallback
    kb_path = settings.resolve_kb_path()
    kb_exists = Path(kb_path).exists()
    
    # Print startup banner
    print("\n" + "="*70)
    print("🚀 WATANBOT API ENTRYPOINT: apps/api/main.py")
    print("="*70)
    print(f"📂 Working directory: {Path.cwd()}")
    print(f"📦 KB_SQLITE_PATH: {kb_path}")
    print(f"   {'✅ exists' if kb_exists else '❌ MISSING'}")
    print(f"🔌 Mounted routers: Public, Admin, Superadmin, KBv3, KBv2, WhatsApp")
    print(f"🌐 API listening on: {settings.api_host}:{settings.api_port}")
    print("="*70 + "\n")
    
    logger.info(
        "watanbot_api_starting",
        version="1.0.0",
        entrypoint="apps/api/main.py",
        kb_path=kb_path,
        kb_exists=kb_exists,
        config={
            "postgres_host": settings.postgres_host,
            "api_port": settings.api_port,
            "cors_origins": settings.cors_origins_list,
        },
    )
    yield
    logger.info("watanbot_api_shutdown")


# Create FastAPI app
app = FastAPI(
    title="WatanBot API",
    description="Bilingual Municipality Chatbot with Self-Learning",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    rate_limit=settings.rate_limit_per_minute,
    backend=settings.rate_limit_backend,
    redis_url=settings.rate_limit_redis_url,
)

# Include routers
app.include_router(public.router, tags=["Public"])
app.include_router(admin.router, tags=["Admin"])
app.include_router(superadmin.router, tags=["Superadmin"])
app.include_router(kb_v3.router, tags=["KBv3"])
app.include_router(kb_v2.router, tags=["KBv2"])
app.include_router(whatsapp.router)
if settings.app_env == "dev" and settings.whatsapp_simulation_enabled:
    app.include_router(whatsapp_sim.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "apps.api.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        log_level=settings.log_level.lower()
    )
