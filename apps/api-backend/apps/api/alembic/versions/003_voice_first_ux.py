"""Voice-first UX fields and WhatsApp media

Revision ID: 003
Revises: 002
Create Date: 2026-02-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("wa_users", sa.Column("voice_preferred", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    op.add_column("wa_users", sa.Column("muted", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("wa_users", sa.Column("mode", sa.String(20), server_default="guided", nullable=False))
    op.add_column("wa_users", sa.Column("language_pref", sa.String(5), server_default="ar", nullable=False))
    op.add_column("wa_users", sa.Column("paging_state_json", postgresql.JSONB()))
    op.add_column("wa_users", sa.Column("last_location_json", postgresql.JSONB()))
    op.add_column("wa_users", sa.Column("doc_type_hint", sa.String(50)))

    op.create_table(
        "wa_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone_number", sa.String(30), nullable=False),
        sa.Column("media_id", sa.String(200)),
        sa.Column("media_type", sa.String(30)),
        sa.Column("mime_type", sa.String(100)),
        sa.Column("file_path", sa.Text()),
        sa.Column("metadata", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_wa_media_phone", "wa_media", ["phone_number"])


def downgrade():
    op.drop_index("ix_wa_media_phone", table_name="wa_media")
    op.drop_table("wa_media")
    op.drop_column("wa_users", "doc_type_hint")
    op.drop_column("wa_users", "last_location_json")
    op.drop_column("wa_users", "paging_state_json")
    op.drop_column("wa_users", "language_pref")
    op.drop_column("wa_users", "mode")
    op.drop_column("wa_users", "muted")
    op.drop_column("wa_users", "voice_preferred")
