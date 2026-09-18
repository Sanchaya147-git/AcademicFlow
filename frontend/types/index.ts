export type User = { id: string; name: string; email: string; role: string; department: string | null };
export type Activity = {
  id: string; activity_id: string; activity_name: string; department: string; course: string; unit: string;
  class_section: string; semester: string; faculty: string | null; activity_type: string; location: string | null;
  planned_start: string; planned_end: string; actual_start: string | null; actual_end: string | null;
  completion_percentage: number; status: string; is_demo: boolean;
};
export type Event = {
  id: string; report_id: string; activity_description: string | null; source_excerpt: string | null;
  department: string | null; course: string | null; unit: string | null; class_section: string | null;
  faculty: string | null; event_date: string | null; disposition: string; status: string | null;
};
export type Report = { id: string; report_id: string; raw_content: string; submitted_at: string; source_type: string; status: string; events: Event[]; file_metadata: Record<string, unknown> | null };
export type Candidate = { id: string; activity_id: string | null; activity: Activity | null; final_confidence: number; semantic_score: number; decision: string; decision_type: string; match_reason: string; evidence: Record<string, unknown> };
export type ReviewItem = { event: Event; report: Report; candidates: Candidate[] };
export type Audit = { id: string; action: string; timestamp: string; event_id: string | null; performed_by: string; previous_value: unknown; new_value: unknown; details: Record<string, unknown> };
export type Group = { name: string; planned: number; completed: number; progress: number };
export type Analytics = {
  summary: Record<string, number | null>; demonstration_data: boolean; departments: Group[]; courses: Group[]; units: Group[];
  actual_sessions: number; planned_sessions: number; average_actual_duration_minutes: number | null; duration_sample_size: number;
  completion_rate: number | null; status_distribution: { name: string; value: number }[];
  schedule_variance: { id: string; name: string; variance_days: number | null; planned_end: string; actual_end: string | null }[];
  historical_activity: { activity_id: string; name: string; actual_sessions: number; planned_sessions: number | null; sample_size: number; historical_average: number | null; note: string }[];
};
