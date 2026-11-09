-- Store response bookmarks in Supabase so they follow the user's account.
CREATE TABLE IF NOT EXISTS saved_responses (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_responses_user_created_at
  ON saved_responses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_responses_chat_id
  ON saved_responses(chat_id);

ALTER TABLE saved_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own saved responses" ON saved_responses;
CREATE POLICY "Users can view their own saved responses" ON saved_responses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can save their own chat messages" ON saved_responses;
CREATE POLICY "Users can save their own chat messages" ON saved_responses
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM chats c
      JOIN messages m ON m.chat_id = c.id
      WHERE c.id = saved_responses.chat_id
        AND c.user_id = auth.uid()
        AND m.id = saved_responses.message_id
    )
  );

DROP POLICY IF EXISTS "Users can remove their own saved responses" ON saved_responses;
CREATE POLICY "Users can remove their own saved responses" ON saved_responses
  FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON TABLE saved_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE saved_responses TO authenticated;
