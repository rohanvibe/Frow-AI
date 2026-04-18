-- Create tables for Threadly

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Untitled Chat',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  template TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Policies for chats
CREATE POLICY "Users can view their own chats" ON chats 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own chats" ON chats 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own chats" ON chats 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chats" ON chats 
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for messages
CREATE POLICY "Users can view messages in their chats" ON messages 
  FOR SELECT USING (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert messages in their chats" ON messages 
  FOR INSERT WITH CHECK (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

-- Policies for prompts
CREATE POLICY "Users can view their own prompts" ON prompts 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own prompts" ON prompts 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own prompts" ON prompts 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own prompts" ON prompts 
  FOR DELETE USING (auth.uid() = user_id);

-- Public access policies for Viral Sharing
CREATE POLICY "Public chats are viewable by everyone" ON chats 
  FOR SELECT USING (is_public = true);

CREATE POLICY "Public messages are viewable by everyone" ON messages 
  FOR SELECT USING (
    chat_id IN (SELECT id FROM chats WHERE is_public = true)
  );

CREATE POLICY "Public prompts are viewable by everyone" ON prompts 
  FOR SELECT USING (is_public = true);

-- Profiles Table (Personalization & Memory)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_instructions TEXT DEFAULT '',
  ai_memory JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON profiles 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles 
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);
