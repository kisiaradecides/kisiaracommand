-- Missions
CREATE TABLE IF NOT EXISTS public.missions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  deadline     DATE,
  status       VARCHAR(20) NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','completed','cancelled')),
  created_by   UUID        NOT NULL REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_missions_status   ON public.missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_deadline ON public.missions(deadline);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_missions" ON public.missions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

CREATE POLICY "team_read_missions" ON public.missions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('aspirant','super_user','team_lead','assistant','opinion_leader')
    )
  );

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id     UUID        REFERENCES public.missions(id) ON DELETE SET NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  region_id      INT         REFERENCES public.regions(id),
  assigned_to    UUID        REFERENCES public.users(id),
  priority       VARCHAR(10) NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('high','medium','low')),
  status         VARCHAR(20) NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('todo','in_progress','under_review','completed')),
  due_date       DATE,
  progress       INT         DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_metric  INT,
  current_metric INT         DEFAULT 0,
  created_by     UUID        NOT NULL REFERENCES public.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned      ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_region        ON public.tasks(region_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status        ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_mission       ON public.tasks(mission_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority_due  ON public.tasks(priority, due_date);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Aspirant sees and manages everything
CREATE POLICY "admin_all_tasks" ON public.tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

-- Team leads/assistants see tasks in their region or assigned to them
CREATE POLICY "team_read_region_tasks" ON public.tasks
  FOR SELECT USING (
    region_id = (SELECT region_id FROM public.users WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role IN ('team_lead','assistant')
    )
  );

-- Any user can see tasks assigned to themselves
CREATE POLICY "users_read_assigned_tasks" ON public.tasks
  FOR SELECT USING (
    assigned_to = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Assignees can update their own tasks
CREATE POLICY "assignee_update_own_task" ON public.tasks
  FOR UPDATE USING (
    assigned_to = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Task Comments
CREATE TABLE IF NOT EXISTS public.task_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES public.users(id),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task    ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created ON public.task_comments(created_at);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Anyone who can see the task can see/add comments
CREATE POLICY "task_participants_comments" ON public.task_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
        AND (
          EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
          OR t.assigned_to = (SELECT id FROM public.users WHERE auth_id = auth.uid())
          OR (t.region_id = (SELECT region_id FROM public.users WHERE auth_id = auth.uid())
              AND EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('team_lead','assistant')))
        )
    )
  );
