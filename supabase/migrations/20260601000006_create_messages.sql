CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID        NOT NULL REFERENCES public.users(id),
  receiver_id UUID        NOT NULL REFERENCES public.users(id),
  content     TEXT        NOT NULL,
  is_read     BOOLEAN     DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_participants    ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON public.messages(receiver_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_created        ON public.messages(created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages they sent or received
CREATE POLICY "users_read_own_messages" ON public.messages
  FOR SELECT USING (
    sender_id   = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR receiver_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Users can insert messages where they are the sender
CREATE POLICY "users_insert_own_messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Aspirant/super_user can update (mark as read)
CREATE POLICY "admin_update_messages" ON public.messages
  FOR UPDATE USING (
    receiver_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );
