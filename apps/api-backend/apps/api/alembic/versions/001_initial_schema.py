"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2026-02-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    
    # KB Cards table
    op.create_table(
        'kb_cards',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('slug', sa.String(255), nullable=False, unique=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('locales', postgresql.JSONB, nullable=False),
        sa.Column('sources', postgresql.JSONB),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('fts', postgresql.TSVECTOR, nullable=False, server_default=sa.text("to_tsvector('simple', '')")),
    )
    op.create_index('ix_kb_cards_slug', 'kb_cards', ['slug'])
    op.create_index('ix_kb_cards_status', 'kb_cards', ['status'])
    op.create_index('ix_kb_cards_fts', 'kb_cards', ['fts'], postgresql_using='gin')
    
    # Trigger to auto-update FTS column
    op.execute("""
        CREATE OR REPLACE FUNCTION kb_cards_fts_update() RETURNS TRIGGER AS $$
        BEGIN
            NEW.fts := to_tsvector('simple',
                coalesce(NEW.locales->'ar'->>'title', '') || ' ' ||
                coalesce(NEW.locales->'ar'->>'body', '') || ' ' ||
                coalesce(NEW.locales->'ar'->>'summary', '') || ' ' ||
                coalesce(NEW.locales->'en'->>'title', '') || ' ' ||
                coalesce(NEW.locales->'en'->>'body', '') || ' ' ||
                coalesce(NEW.locales->'en'->>'summary', '')
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    op.execute("""
        CREATE TRIGGER kb_cards_fts_trigger
        BEFORE INSERT OR UPDATE ON kb_cards
        FOR EACH ROW EXECUTE FUNCTION kb_cards_fts_update();
    """)
    
    # Chat Sessions table
    op.create_table(
        'chat_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('meta', postgresql.JSONB),
    )
    
    # Chat Messages table
    op.create_table(
        'chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('lang', sa.String(5), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('kb_hit_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True))),
        sa.Column('confidence', sa.Float()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_chat_messages_session_id', 'chat_messages', ['session_id'])
    op.create_index('ix_chat_messages_created_at', 'chat_messages', ['created_at'])
    
    # Feedback Queue table
    op.create_table(
        'feedback_queue',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True)),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('lang', sa.String(5), nullable=False),
        sa.Column('suggested_kb_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True))),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('resolution', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_feedback_queue_status', 'feedback_queue', ['status'])
    
    # Audit Logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('actor_user_id', postgresql.UUID(as_uuid=True)),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('target_type', sa.String(50)),
        sa.Column('target_id', postgresql.UUID(as_uuid=True)),
        sa.Column('details', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])


def downgrade():
    op.drop_table('audit_logs')
    op.drop_table('feedback_queue')
    op.drop_table('chat_messages')
    op.drop_table('chat_sessions')
    op.execute('DROP TRIGGER IF EXISTS kb_cards_fts_trigger ON kb_cards')
    op.execute('DROP FUNCTION IF EXISTS kb_cards_fts_update')
    op.drop_table('kb_cards')
    op.drop_table('users')
