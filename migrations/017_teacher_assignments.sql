-- ZoKivo teacher-mode assignments: public assignment links to already-published quizzes.
-- Mother Supabase identity still controls authenticated ownership; this Neon table is only accessed via server routes.
CREATE TABLE IF NOT EXISTS teacher_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id text NOT NULL,
 quiz_set_id uuid NOT NULL REFERENCES quiz_sets(id),
 title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
 due_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_owner_created ON teacher_assignments(owner_user_id,created_at DESC);
