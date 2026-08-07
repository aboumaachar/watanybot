import uuid
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, 
    ForeignKey, Index, text, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSVECTOR
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class KBCard(Base):
    __tablename__ = "kb_cards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="draft", index=True)  # draft|published|archived
    locales = Column(JSONB, nullable=False)  # {ar: {title, summary, body, tags}, en: {...}}
    sources = Column(JSONB)  # optional citations
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Full-text search vector (generated)
    fts = Column(
        TSVECTOR,
        nullable=False,
        server_default=text(
            "to_tsvector('simple', '')"
        )
    )
    
    __table_args__ = (
        Index('ix_kb_cards_fts', 'fts', postgresql_using='gin'),
    )


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    meta = Column(JSONB)  # channel, user_agent, city, etc.
    
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user|assistant
    lang = Column(String(5), nullable=False)  # ar|en
    content = Column(Text, nullable=False)
    kb_hit_ids = Column(ARRAY(UUID(as_uuid=True)))  # matched KB cards
    confidence = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    session = relationship("ChatSession", back_populates="messages")


class FeedbackQueue(Base):
    __tablename__ = "feedback_queue"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="SET NULL"))
    question = Column(Text, nullable=False)
    lang = Column(String(5), nullable=False)
    suggested_kb_ids = Column(ARRAY(UUID(as_uuid=True)))
    status = Column(String(20), nullable=False, default="open", index=True)  # open|in_review|resolved|rejected
    resolution = Column(JSONB)  # {action, notes, created_card_id, linked_card_id}
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class WAUser(Base):
    __tablename__ = "wa_users"

    phone_number = Column(String(30), primary_key=True)
    voice_preferred = Column(Boolean, nullable=False, default=True)
    muted = Column(Boolean, nullable=False, default=False)
    caregiver_mode = Column(Boolean, nullable=False, default=False)
    mode = Column(String(20), nullable=False, default="guided")
    language_pref = Column(String(5), nullable=False, default="ar")
    pending_paging = Column(Boolean, nullable=False, default=False)
    paging_cursor = Column(Integer, nullable=False, default=0)
    paging_chunks_count = Column(Integer, nullable=False, default=0)
    paging_chunks = Column(JSONB)
    paging_state_json = Column(JSONB)
    last_location_json = Column(JSONB)
    doc_type_hint = Column(String(50))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class WAMedia(Base):
    __tablename__ = "wa_media"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone_number = Column(String(30), nullable=False, index=True)
    media_id = Column(String(200))
    media_type = Column(String(30))
    mime_type = Column(String(100))
    file_path = Column(Text)
    metadata_json = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class WADedup(Base):
    __tablename__ = "wa_dedup"

    message_id = Column(String(128), primary_key=True)
    phone_number = Column(String(30), nullable=False, index=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # admin|superadmin
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    action = Column(String(100), nullable=False, index=True)
    target_type = Column(String(50))
    target_id = Column(UUID(as_uuid=True))
    details = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
