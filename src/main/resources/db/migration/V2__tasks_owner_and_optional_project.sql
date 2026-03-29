-- V2: Tasks can exist without a list (project), and have a direct owner reference.

-- Add owner_id and backfill from project owner
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id UUID;

UPDATE tasks t
SET owner_id = p.owner_id
FROM projects p
WHERE t.project_id = p.id
  AND t.owner_id IS NULL;

-- Enforce not-null + FK for owner_id
ALTER TABLE tasks ALTER COLUMN owner_id SET NOT NULL;

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_owner_id
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(owner_id);

-- Make project optional and avoid deleting tasks when a project is deleted
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Helpful index for filtering unlisted tasks
CREATE INDEX IF NOT EXISTS idx_tasks_project_id_null ON tasks(project_id) WHERE project_id IS NULL;
