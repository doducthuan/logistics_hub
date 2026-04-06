"""add category table

Revision ID: b7c2a1d0e4f1
Revises: 3e69eaab5959
Create Date: 2026-04-06

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes

revision = "b7c2a1d0e4f1"
down_revision = "3e69eaab5959"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "category",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(length=2000), nullable=True),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("updated_by_id", sa.Uuid(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["account.id"]),
        sa.ForeignKeyConstraint(["parent_id"], ["category.id"]),
        sa.ForeignKeyConstraint(["updated_by_id"], ["account.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("parent_id", "name", name="uq_category_parent_name"),
    )


def downgrade() -> None:
    op.drop_table("category")
