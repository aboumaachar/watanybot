"""Rename wa_media.metadata

Revision ID: 004
Revises: 003
Create Date: 2026-02-06 00:00:00.000000

"""
from alembic import op


revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("wa_media", "metadata", new_column_name="metadata_json")


def downgrade():
    op.alter_column("wa_media", "metadata_json", new_column_name="metadata")
