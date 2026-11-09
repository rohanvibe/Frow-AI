-- Create tables and repeatable RLS policies for Frow AI
-- Safe to rerun without duplicate policy errors or data loss.

-- Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Untitled Chat',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Saved assistant responses belong to a user's account and sync across devices.
CREATE TABLE IF NOT EXISTS saved_responses (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, message_id)
);

-- 3. Prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  template TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Profiles Table (Personalization & Memory)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_instructions TEXT DEFAULT '',
  ai_memory JSONB DEFAULT '[]'::jsonb,
  preferred_model TEXT DEFAULT 'auto',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_saved_responses_user_created_at ON saved_responses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_responses_chat_id ON saved_responses(chat_id);
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Idempotent Policies for chats
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
CREATE POLICY "Users can view their own chats" ON chats 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own chats" ON chats;
CREATE POLICY "Users can create their own chats" ON chats 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
CREATE POLICY "Users can update their own chats" ON chats 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chats" ON chats;
CREATE POLICY "Users can delete their own chats" ON chats 
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public chats are viewable by everyone" ON chats;
CREATE POLICY "Public chats are viewable by everyone" ON chats 
  FOR SELECT USING (is_public = true);

-- Idempotent Policies for messages
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
CREATE POLICY "Users can view messages in their chats" ON messages 
  FOR SELECT USING (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert messages in their chats" ON messages;
CREATE POLICY "Users can insert messages in their chats" ON messages 
  FOR INSERT WITH CHECK (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public messages are viewable by everyone" ON messages;
CREATE POLICY "Public messages are viewable by everyone" ON messages 
  FOR SELECT USING (
    chat_id IN (SELECT id FROM chats WHERE is_public = true)
  );

-- Idempotent Policies for saved responses
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

-- Idempotent Policies for prompts
DROP POLICY IF EXISTS "Users can view their own prompts" ON prompts;
CREATE POLICY "Users can view their own prompts" ON prompts 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own prompts" ON prompts;
CREATE POLICY "Users can create their own prompts" ON prompts 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own prompts" ON prompts;
CREATE POLICY "Users can update their own prompts" ON prompts 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own prompts" ON prompts;
CREATE POLICY "Users can delete their own prompts" ON prompts 
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public prompts are viewable by everyone" ON prompts;
CREATE POLICY "Public prompts are viewable by everyone" ON prompts 
  FOR SELECT USING (is_public = true);

-- Idempotent Policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles 
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles 
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);
