"""WhatsApp dedup and user state tables

Revision ID: 002
Revises: 001
Create Date: 2026-02-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "wa_users",
        sa.Column("phone_number", sa.String(30), primary_key=True),
        sa.Column("caregiver_mode", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("pending_paging", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("paging_cursor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("paging_chunks_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("paging_chunks", postgresql.JSONB()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "wa_dedup",
        sa.Column("message_id", sa.String(128), primary_key=True),
        sa.Column("phone_number", sa.String(30), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_wa_dedup_phone", "wa_dedup", ["phone_number"])


def downgrade():
    op.drop_index("ix_wa_dedup_phone", table_name="wa_dedup")
    op.drop_table("wa_dedup")
    op.drop_table("wa_users")
