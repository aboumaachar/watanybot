import sys
import os
import time
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
import structlog

# Add parent directory to path to import from api
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from config import settings
from database import get_db_context
from models import ChatMessage, FeedbackQueue
from sqlalchemy import text, func

# Configure logging
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

logger = structlog.get_logger()

# Create FastAPI app for health check
app = FastAPI(title="WatanBot Worker")

# Create scheduler
scheduler = BackgroundScheduler()


@app.get("/health")
async def health_check():
    """Worker health check."""
    return {
        "status": "healthy",
        "service": "watanbot-worker",
        "timestamp": time.time(),
        "jobs": [
            {
                "id": job.id,
                "name": job.name,
                "next_run": str(job.next_run_time) if job.next_run_time else None
            }
            for job in scheduler.get_jobs()
        ]
    }


def job_database_maintenance():
    """Run database maintenance tasks (VACUUM ANALYZE)."""
    logger.info("job_started", job="database_maintenance")
    
    try:
        with get_db_context() as db:
            # Vacuum and analyze main tables
            tables = ['kb_cards', 'chat_sessions', 'chat_messages', 'feedback_queue', 'audit_logs']
            
            for table in tables:
                logger.info("vacuum_analyze", table=table)
                # Note: VACUUM cannot run inside a transaction, so we use autocommit
                db.connection().connection.set_isolation_level(0)
                db.execute(text(f"VACUUM ANALYZE {table}"))
                db.connection().connection.set_isolation_level(1)
            
            logger.info("job_completed", job="database_maintenance")
    
    except Exception as e:
        logger.error("job_failed", job="database_maintenance", error=str(e))


def job_prune_old_chats():
    """Prune old chat messages based on retention policy."""
    logger.info("job_started", job="prune_old_chats")
    
    try:
        with get_db_context() as db:
            cutoff_date = datetime.utcnow() - timedelta(days=settings.retention_days_chat)
            
            # Delete old chat messages (cascades to sessions if no messages remain)
            deleted = db.query(ChatMessage).filter(
                ChatMessage.created_at < cutoff_date
            ).delete(synchronize_session=False)
            
            db.commit()
            
            logger.info("job_completed", job="prune_old_chats", deleted_messages=deleted)
    
    except Exception as e:
        logger.error("job_failed", job="prune_old_chats", error=str(e))


def job_daily_metrics():
    """Generate and log daily metrics."""
    logger.info("job_started", job="daily_metrics")
    
    try:
        with get_db_context() as db:
            from models import KBCard, ChatSession, FeedbackQueue
            
            # Count metrics
            total_kb_cards = db.query(func.count(KBCard.id)).scalar()
            published_kb_cards = db.query(func.count(KBCard.id)).filter(KBCard.status == 'published').scalar()
            
            # Count sessions from last 24 hours
            yesterday = datetime.utcnow() - timedelta(days=1)
            sessions_24h = db.query(func.count(ChatSession.id)).filter(
                ChatSession.created_at >= yesterday
            ).scalar()
            
            # Count messages from last 24 hours
            messages_24h = db.query(func.count(ChatMessage.id)).filter(
                ChatMessage.created_at >= yesterday
            ).scalar()
            
            # Count open feedback
            open_feedback = db.query(func.count(FeedbackQueue.id)).filter(
                FeedbackQueue.status == 'open'
            ).scalar()
            
            metrics = {
                "total_kb_cards": total_kb_cards,
                "published_kb_cards": published_kb_cards,
                "sessions_24h": sessions_24h,
                "messages_24h": messages_24h,
                "open_feedback": open_feedback
            }
            
            logger.info("daily_metrics", **metrics)
            logger.info("job_completed", job="daily_metrics")
    
    except Exception as e:
        logger.error("job_failed", job="daily_metrics", error=str(e))


@app.on_event("startup")
async def startup_event():
    """Start the scheduler on app startup."""
    logger.info("worker_starting", config={
        "retention_days_chat": settings.retention_days_chat,
    })
    
    # Schedule jobs
    # Database maintenance: daily at 2 AM
    scheduler.add_job(
        job_database_maintenance,
        trigger=CronTrigger.from_crontab(os.getenv('WORKER_SCHEDULE_MAINTENANCE', '0 2 * * *')),
        id='database_maintenance',
        name='Database Maintenance',
        replace_existing=True
    )
    
    # Prune old chats: daily at 3 AM
    scheduler.add_job(
        job_prune_old_chats,
        trigger=CronTrigger.from_crontab('0 3 * * *'),
        id='prune_old_chats',
        name='Prune Old Chats',
        replace_existing=True
    )
    
    # Daily metrics: every hour
    scheduler.add_job(
        job_daily_metrics,
        trigger=CronTrigger.from_crontab(os.getenv('WORKER_SCHEDULE_METRICS', '0 * * * *')),
        id='daily_metrics',
        name='Daily Metrics',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("worker_started", jobs=len(scheduler.get_jobs()))


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown the scheduler."""
    logger.info("worker_shutdown")
    scheduler.shutdown()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        log_level=settings.log_level.lower()
    )
