export type DemoUser = { id: string; display_name: string; role: 'admin' | 'applicant' };
export type Requirement = { id: string; description: string };
export type Grant = {
  id: string; creator_id: string; reviewer_id: string; title: string; description: string;
  eligibility: string; requirements: Requirement[]; status: 'Draft' | 'Open' | 'Closed'; revision: number;
  accepts_applications: boolean; unavailable_reason: string | null;
  budget_cents?: number; committed_cents?: number; available_cents?: number; distributed_cents?: number;
  undistributed_cents?: number; applicant_count?: number; unreviewed_count?: number;
};
export type Evidence = { id: string; filename: string; requirement_id: string };
export type Application = {
  id: string; grant_id: string; applicant_id: string; name: string; email: string; requested_cents: number;
  status: 'Unreviewed' | 'Approved' | 'Rejected'; submitted_at: string; decided_at: string | null;
  decided_by: string | null; internal_note?: string | null;
  snapshot: { title: string; description: string; eligibility: string; requirements: Requirement[] };
  award_cents: number; distributed_cents: number; documents: Evidence[];
};
export type Snapshot = { generation: number; grants: Grant[]; applications: Application[] };
