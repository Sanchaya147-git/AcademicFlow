"""Initial academic execution schema"""
from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy

revision = '02d935052051'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table('academic_activities',
    sa.Column('activity_id', sa.String(length=80), nullable=False),
    sa.Column('parent_id', sa.Uuid(), nullable=True),
    sa.Column('semester', sa.String(), nullable=False),
    sa.Column('department', sa.String(), nullable=False),
    sa.Column('course', sa.String(), nullable=False),
    sa.Column('unit', sa.String(), nullable=False),
    sa.Column('activity_name', sa.String(), nullable=False),
    sa.Column('activity_type', sa.String(), nullable=False),
    sa.Column('faculty', sa.String(), nullable=True),
    sa.Column('class_section', sa.String(), nullable=False),
    sa.Column('location', sa.String(), nullable=True),
    sa.Column('level', sa.Integer(), nullable=False),
    sa.Column('planned_start', sa.Date(), nullable=False),
    sa.Column('planned_end', sa.Date(), nullable=False),
    sa.Column('actual_start', sa.Date(), nullable=True),
    sa.Column('actual_end', sa.Date(), nullable=True),
    sa.Column('completion_percentage', sa.Float(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('embedding', pgvector.sqlalchemy.vector.VECTOR(dim=1536).with_variant(sa.JSON(), 'sqlite'), nullable=True),
    sa.Column('embedding_model', sa.String(), nullable=True),
    sa.Column('is_demo', sa.Boolean(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('actual_end IS NULL OR actual_start IS NULL OR actual_end >= actual_start'),
    sa.CheckConstraint('completion_percentage >= 0 AND completion_percentage <= 100'),
    sa.CheckConstraint('level >= 1 AND level <= 6'),
    sa.CheckConstraint('planned_end >= planned_start'),
    sa.ForeignKeyConstraint(['parent_id'], ['academic_activities.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_academic_activities_activity_id'), 'academic_activities', ['activity_id'], unique=True)
    op.create_index(op.f('ix_academic_activities_class_section'), 'academic_activities', ['class_section'], unique=False)
    op.create_index(op.f('ix_academic_activities_course'), 'academic_activities', ['course'], unique=False)
    op.create_index(op.f('ix_academic_activities_department'), 'academic_activities', ['department'], unique=False)
    op.create_table('users',
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('password_hash', sa.String(), nullable=False),
    sa.Column('role', sa.String(), nullable=False),
    sa.Column('department', sa.String(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("role IN ('FACULTY','LAB_STAFF','COORDINATOR','HOD','ADMIN')"),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('execution_reports',
    sa.Column('report_id', sa.String(), nullable=False),
    sa.Column('source_type', sa.String(), nullable=False),
    sa.Column('source_file', sa.String(), nullable=True),
    sa.Column('file_metadata', sa.JSON(), nullable=True),
    sa.Column('raw_content', sa.String(), nullable=False),
    sa.Column('submitted_by', sa.Uuid(), nullable=False),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("source_type IN ('FREE_TEXT','SPREADSHEET','VOICE_TRANSCRIPT')"),
    sa.ForeignKeyConstraint(['submitted_by'], ['users.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('report_id')
    )
    op.create_index(op.f('ix_execution_reports_submitted_by'), 'execution_reports', ['submitted_by'], unique=False)
    op.create_table('extracted_events',
    sa.Column('report_id', sa.Uuid(), nullable=False),
    sa.Column('source_row', sa.Integer(), nullable=False),
    sa.Column('activity_description', sa.String(), nullable=True),
    sa.Column('department', sa.String(), nullable=True),
    sa.Column('course', sa.String(), nullable=True),
    sa.Column('unit', sa.String(), nullable=True),
    sa.Column('class_section', sa.String(), nullable=True),
    sa.Column('faculty', sa.String(), nullable=True),
    sa.Column('location', sa.String(), nullable=True),
    sa.Column('event_date', sa.Date(), nullable=True),
    sa.Column('start_time', sa.Time(), nullable=True),
    sa.Column('end_time', sa.Time(), nullable=True),
    sa.Column('status', sa.String(), nullable=True),
    sa.Column('completion_percentage', sa.Float(), nullable=True),
    sa.Column('source_excerpt', sa.String(), nullable=True),
    sa.Column('normalized_concept', sa.String(), nullable=True),
    sa.Column('disposition', sa.String(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('completion_percentage IS NULL OR (completion_percentage >= 0 AND completion_percentage <= 100)'),
    sa.ForeignKeyConstraint(['report_id'], ['execution_reports.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('report_id', 'source_row')
    )
    op.create_index(op.f('ix_extracted_events_class_section'), 'extracted_events', ['class_section'], unique=False)
    op.create_index(op.f('ix_extracted_events_course'), 'extracted_events', ['course'], unique=False)
    op.create_index(op.f('ix_extracted_events_department'), 'extracted_events', ['department'], unique=False)
    op.create_index(op.f('ix_extracted_events_event_date'), 'extracted_events', ['event_date'], unique=False)
    op.create_index(op.f('ix_extracted_events_report_id'), 'extracted_events', ['report_id'], unique=False)
    op.create_table('activity_matches',
    sa.Column('event_id', sa.Uuid(), nullable=False),
    sa.Column('activity_id', sa.Uuid(), nullable=True),
    sa.Column('semantic_score', sa.Float(), nullable=False),
    sa.Column('course_score', sa.Float(), nullable=True),
    sa.Column('class_score', sa.Float(), nullable=True),
    sa.Column('department_score', sa.Float(), nullable=True),
    sa.Column('unit_score', sa.Float(), nullable=True),
    sa.Column('faculty_score', sa.Float(), nullable=True),
    sa.Column('context_score', sa.Float(), nullable=True),
    sa.Column('fuzzy_score', sa.Float(), nullable=False),
    sa.Column('final_confidence', sa.Float(), nullable=False),
    sa.Column('decision', sa.String(), nullable=False),
    sa.Column('decision_type', sa.String(), nullable=False),
    sa.Column('match_reason', sa.String(), nullable=False),
    sa.Column('evidence', sa.JSON(), nullable=False),
    sa.Column('reviewer_id', sa.Uuid(), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("decision IN ('AUTO_LINK','HUMAN_REVIEW','UNMATCHED')"),
    sa.CheckConstraint('final_confidence >= 0 AND final_confidence <= 1'),
    sa.ForeignKeyConstraint(['activity_id'], ['academic_activities.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['event_id'], ['extracted_events.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('event_id', 'activity_id')
    )
    op.create_index(op.f('ix_activity_matches_activity_id'), 'activity_matches', ['activity_id'], unique=False)
    op.create_index(op.f('ix_activity_matches_event_id'), 'activity_matches', ['event_id'], unique=False)
    op.create_table('audit_logs',
    sa.Column('event_id', sa.Uuid(), nullable=True),
    sa.Column('activity_id', sa.Uuid(), nullable=True),
    sa.Column('report_id', sa.Uuid(), nullable=True),
    sa.Column('action', sa.String(), nullable=False),
    sa.Column('performed_by', sa.Uuid(), nullable=False),
    sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
    sa.Column('previous_value', sa.JSON(), nullable=True),
    sa.Column('new_value', sa.JSON(), nullable=True),
    sa.Column('metadata', sa.JSON(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['activity_id'], ['academic_activities.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['event_id'], ['extracted_events.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['performed_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['report_id'], ['execution_reports.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_activity_id'), 'audit_logs', ['activity_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_event_id'), 'audit_logs', ['event_id'], unique=False)
    op.create_table('execution_activity_links',
    sa.Column('execution_event_id', sa.Uuid(), nullable=False),
    sa.Column('academic_activity_id', sa.Uuid(), nullable=False),
    sa.Column('relationship_type', sa.String(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['academic_activity_id'], ['academic_activities.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['execution_event_id'], ['extracted_events.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('execution_event_id', 'academic_activity_id')
    )
    op.create_index(op.f('ix_execution_activity_links_academic_activity_id'), 'execution_activity_links', ['academic_activity_id'], unique=False)
    # ### end Alembic commands ###

def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_execution_activity_links_academic_activity_id'), table_name='execution_activity_links')
    op.drop_table('execution_activity_links')
    op.drop_index(op.f('ix_audit_logs_event_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_activity_id'), table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_index(op.f('ix_activity_matches_event_id'), table_name='activity_matches')
    op.drop_index(op.f('ix_activity_matches_activity_id'), table_name='activity_matches')
    op.drop_table('activity_matches')
    op.drop_index(op.f('ix_extracted_events_report_id'), table_name='extracted_events')
    op.drop_index(op.f('ix_extracted_events_event_date'), table_name='extracted_events')
    op.drop_index(op.f('ix_extracted_events_department'), table_name='extracted_events')
    op.drop_index(op.f('ix_extracted_events_course'), table_name='extracted_events')
    op.drop_index(op.f('ix_extracted_events_class_section'), table_name='extracted_events')
    op.drop_table('extracted_events')
    op.drop_index(op.f('ix_execution_reports_submitted_by'), table_name='execution_reports')
    op.drop_table('execution_reports')
    op.drop_table('users')
    op.drop_index(op.f('ix_academic_activities_department'), table_name='academic_activities')
    op.drop_index(op.f('ix_academic_activities_course'), table_name='academic_activities')
    op.drop_index(op.f('ix_academic_activities_class_section'), table_name='academic_activities')
    op.drop_index(op.f('ix_academic_activities_activity_id'), table_name='academic_activities')
    op.drop_table('academic_activities')
    # ### end Alembic commands ###
