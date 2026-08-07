import os
import subprocess
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from database import get_db, engine
from models import User, KBCard, ChatSession, FeedbackQueue, AuditLog
from schemas import DoctorResponse, DoctorCheckResult, BackupResponse, MetricsResponse, AuditLogItem
from auth import require_superadmin
from config import settings
import structlog

logger = structlog.get_logger()
router = APIRouter()


@router.get("/superadmin/doctor", response_model=DoctorResponse)
async def run_doctor_checks(
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Run comprehensive system health checks."""
    checks = []
    
    # Check 1: Database connection
    try:
        db.execute(text("SELECT 1"))
        checks.append(DoctorCheckResult(
            check="database_connection",
            status="ok",
            message="Database connection successful"
        ))
    except Exception as e:
        checks.append(DoctorCheckResult(
            check="database_connection",
            status="error",
            message=f"Database connection failed: {str(e)}"
        ))
    
    # Check 2: FTS index exists
    try:
        result = db.execute(text("""
            SELECT COUNT(*) FROM pg_indexes 
            WHERE tablename = 'kb_cards' AND indexname = 'ix_kb_cards_fts'
        """)).scalar()
        
        if result > 0:
            checks.append(DoctorCheckResult(
                check="fts_index",
                status="ok",
                message="Full-text search index exists"
            ))
        else:
            checks.append(DoctorCheckResult(
                check="fts_index",
                status="error",
                message="FTS index missing"
            ))
    except Exception as e:
        checks.append(DoctorCheckResult(
            check="fts_index",
            status="error",
            message=f"Failed to check FTS index: {str(e)}"
        ))
    
    # Check 3: Published KB cards
    try:
        count = db.query(func.count(KBCard.id)).filter(KBCard.status == 'published').scalar()
        if count > 0:
            checks.append(DoctorCheckResult(
                check="kb_cards_published",
                status="ok",
                message=f"Found {count} published KB cards",
                details={"count": count}
            ))
        else:
            checks.append(DoctorCheckResult(
                check="kb_cards_published",
                status="warning",
                message="No published KB cards found"
            ))
    except Exception as e:
        checks.append(DoctorCheckResult(
            check="kb_cards_published",
            status="error",
            message=f"Failed to count KB cards: {str(e)}"
        ))
    
    # Check 4: Superadmin user exists
    try:
        count = db.query(func.count(User.id)).filter(User.role == 'superadmin', User.is_active == True).scalar()
        if count > 0:
            checks.append(DoctorCheckResult(
                check="superadmin_exists",
                status="ok",
                message=f"Found {count} active superadmin(s)"
            ))
        else:
            checks.append(DoctorCheckResult(
                check="superadmin_exists",
                status="error",
                message="No active superadmin found"
            ))
    except Exception as e:
        checks.append(DoctorCheckResult(
            check="superadmin_exists",
            status="error",
            message=f"Failed to check superadmin: {str(e)}"
        ))
    
    # Check 5: Disk space for backups
    try:
        backup_dir = settings.backup_dir
        if os.path.exists(backup_dir):
            stat = os.statvfs(backup_dir)
            free_gb = (stat.f_bavail * stat.f_frsize) / (1024**3)
            
            if free_gb > 5:
                checks.append(DoctorCheckResult(
                    check="backup_disk_space",
                    status="ok",
                    message=f"Sufficient disk space: {free_gb:.2f} GB free",
                    details={"free_gb": free_gb}
                ))
            else:
                checks.append(DoctorCheckResult(
                    check="backup_disk_space",
                    status="warning",
                    message=f"Low disk space: {free_gb:.2f} GB free",
                    details={"free_gb": free_gb}
                ))
        else:
            checks.append(DoctorCheckResult(
                check="backup_disk_space",
                status="warning",
                message=f"Backup directory does not exist: {backup_dir}"
            ))
    except Exception as e:
        checks.append(DoctorCheckResult(
            check="backup_disk_space",
            status="error",
            message=f"Failed to check disk space: {str(e)}"
        ))
    
    # Determine overall status
    statuses = [c.status for c in checks]
    if "error" in statuses:
        overall_status = "error"
    elif "warning" in statuses:
        overall_status = "warning"
    else:
        overall_status = "ok"
    
    return DoctorResponse(
        overall_status=overall_status,
        checks=checks,
        timestamp=datetime.now(timezone.utc)
    )


@router.post("/superadmin/backup", response_model=BackupResponse)
async def create_backup(
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Create a database backup using pg_dump."""
    try:
        # Ensure backup directory exists
        os.makedirs(settings.backup_dir, exist_ok=True)
        
        # Generate backup filename
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(settings.backup_dir, f"watanbot_{timestamp}.sql.gz")
        
        # Build pg_dump command
        env = os.environ.copy()
        env['PGPASSWORD'] = settings.postgres_password
        
        cmd = [
            "pg_dump",
            "-h", settings.postgres_host,
            "-p", str(settings.postgres_port),
            "-U", settings.postgres_user,
            "-d", settings.postgres_db,
            "-Fc",  # Custom format (compressed)
            "-f", backup_file
        ]
        
        # Execute backup
        result = subprocess.run(cmd, env=env, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"pg_dump failed: {result.stderr}")
        
        # Get file size
        size_bytes = os.path.getsize(backup_file)
        
        # Audit log
        audit = AuditLog(
            actor_user_id=current_user.id,
            action="backup_create",
            target_type="database",
            details={"backup_file": backup_file, "size_bytes": size_bytes}
        )
        db.add(audit)
        db.commit()
        
        logger.info("backup_created", backup_file=backup_file, size_bytes=size_bytes)
        
        return BackupResponse(
            success=True,
            backup_file=backup_file,
            size_bytes=size_bytes,
            timestamp=datetime.now(timezone.utc)
        )
    
    except Exception as e:
        logger.error("backup_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")


@router.post("/superadmin/restore")
async def restore_backup(
    backup_file: str,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Restore database from a backup file."""
    try:
        if not os.path.exists(backup_file):
            raise HTTPException(status_code=404, detail="Backup file not found")
        
        # Audit log (before restore, in case it fails)
        audit = AuditLog(
            actor_user_id=current_user.id,
            action="backup_restore",
            target_type="database",
            details={"backup_file": backup_file}
        )
        db.add(audit)
        db.commit()
        
        # Build pg_restore command
        env = os.environ.copy()
        env['PGPASSWORD'] = settings.postgres_password
        
        cmd = [
            "pg_restore",
            "-h", settings.postgres_host,
            "-p", str(settings.postgres_port),
            "-U", settings.postgres_user,
            "-d", settings.postgres_db,
            "--clean",  # Drop existing objects
            "--if-exists",
            backup_file
        ]
        
        # Execute restore
        result = subprocess.run(cmd, env=env, capture_output=True, text=True)
        
        if result.returncode != 0:
            # pg_restore warnings are common, check stderr for actual errors
            if "error" in result.stderr.lower():
                raise Exception(f"pg_restore failed: {result.stderr}")
        
        logger.info("backup_restored", backup_file=backup_file)
        
        return {
            "success": True,
            "backup_file": backup_file,
            "message": "Database restored successfully"
        }
    
    except Exception as e:
        logger.error("restore_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")


@router.get("/superadmin/metrics", response_model=MetricsResponse)
async def get_metrics(
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Get system metrics."""
    total_kb_cards = db.query(func.count(KBCard.id)).scalar()
    published_kb_cards = db.query(func.count(KBCard.id)).filter(KBCard.status == 'published').scalar()
    total_chat_sessions = db.query(func.count(ChatSession.id)).scalar()
    total_feedback_items = db.query(func.count(FeedbackQueue.id)).scalar()
    open_feedback_items = db.query(func.count(FeedbackQueue.id)).filter(FeedbackQueue.status == 'open').scalar()
    
    return MetricsResponse(
        total_kb_cards=total_kb_cards,
        published_kb_cards=published_kb_cards,
        total_chat_sessions=total_chat_sessions,
        total_feedback_items=total_feedback_items,
        open_feedback_items=open_feedback_items,
        timestamp=datetime.now(timezone.utc)
    )


@router.get("/superadmin/audit", response_model=List[AuditLogItem])
async def get_audit_logs(
    action: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Get audit logs."""
    query = db.query(AuditLog)
    
    if action:
        query = query.filter(AuditLog.action == action)
    
    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return logs
