-- Supabase Database Schema for BookIQ Online Storage
-- Run this in your Supabase SQL editor to create the required tables

-- Enable Row Level Security (RLS)
ALTER TABLE IF EXISTS history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_maker ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS flash_card_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expiring_credits ENABLE ROW LEVEL SECURITY;

-- History table
CREATE TABLE IF NOT EXISTS history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  imageUri TEXT,
  feature TEXT NOT NULL,
  extractedText TEXT,
  aiAnswer TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scan Notes table
CREATE TABLE IF NOT EXISTS scan_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz Maker table
CREATE TABLE IF NOT EXISTS quiz_maker (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  quiz_type TEXT DEFAULT 'multiple-choice',
  source_note_id BIGINT,
  source_note_type TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flash Card Sets table
CREATE TABLE IF NOT EXISTS flash_card_sets (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  card_type TEXT DEFAULT 'basic',
  source_note_id BIGINT,
  source_note_type TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credits table (permanent credits)
CREATE TABLE IF NOT EXISTS credits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER DEFAULT 0 CHECK (balance >= 0),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expiring Credits table
CREATE TABLE IF NOT EXISTS expiring_credits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking user purchases
CREATE TABLE IF NOT EXISTS purchases (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    product_id TEXT NOT NULL,
    purchase_date TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_id TEXT UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking credit restoration attempts
CREATE TABLE IF NOT EXISTS credit_restorations (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    product_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    expected_credits INTEGER NOT NULL,
    actual_credits_added INTEGER NOT NULL DEFAULT 0,
    restoration_reason TEXT DEFAULT 'verification' CHECK (restoration_reason IN ('initial_purchase', 'verification', 'manual_restore')),
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_scan_notes_user_id ON scan_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_notes_created_at ON scan_notes(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_maker_user_id ON quiz_maker(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_maker_created_at ON quiz_maker(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_flash_card_sets_user_id ON flash_card_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_flash_card_sets_created_at ON flash_card_sets(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_expiring_credits_user_id ON expiring_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_expiring_credits_expires_at ON expiring_credits(expires_at);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_transaction_id ON purchases(transaction_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);

CREATE INDEX IF NOT EXISTS idx_credit_restorations_user_id ON credit_restorations(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_restorations_transaction_id ON credit_restorations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_credit_restorations_status ON credit_restorations(status);
CREATE INDEX IF NOT EXISTS idx_credit_restorations_created_at ON credit_restorations(created_at);

-- Row Level Security Policies

-- History policies
CREATE POLICY "Users can view their own history" ON history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history" ON history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own history" ON history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history" ON history
  FOR DELETE USING (auth.uid() = user_id);

-- Notes policies
CREATE POLICY "Users can view their own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);

-- Scan Notes policies
CREATE POLICY "Users can view their own scan notes" ON scan_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scan notes" ON scan_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scan notes" ON scan_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scan notes" ON scan_notes
  FOR DELETE USING (auth.uid() = user_id);

-- Quiz Maker policies
CREATE POLICY "Users can view their own quizzes" ON quiz_maker
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quizzes" ON quiz_maker
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quizzes" ON quiz_maker
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quizzes" ON quiz_maker
  FOR DELETE USING (auth.uid() = user_id);

-- Flash Card Sets policies
CREATE POLICY "Users can view their own flash card sets" ON flash_card_sets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flash card sets" ON flash_card_sets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flash card sets" ON flash_card_sets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flash card sets" ON flash_card_sets
  FOR DELETE USING (auth.uid() = user_id);

-- Credits policies
CREATE POLICY "Users can view their own credits" ON credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credits" ON credits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits" ON credits
  FOR UPDATE USING (auth.uid() = user_id);

-- Expiring Credits policies
CREATE POLICY "Users can view their own expiring credits" ON expiring_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expiring credits" ON expiring_credits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expiring credits" ON expiring_credits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expiring credits" ON expiring_credits
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for purchases table
CREATE POLICY "Users can view their own purchases" ON purchases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases" ON purchases
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchases" ON purchases
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for credit_restorations table
CREATE POLICY "Users can view their own credit restorations" ON credit_restorations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credit restorations" ON credit_restorations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to automatically update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updatedAt for credits table
CREATE TRIGGER update_credits_updated_at 
    BEFORE UPDATE ON credits 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired credits (can be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_credits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM expiring_credits 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at for purchases table
CREATE TRIGGER update_purchases_updated_at 
    BEFORE UPDATE ON purchases 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get user's purchase statistics
CREATE OR REPLACE FUNCTION get_user_purchase_stats(user_uuid UUID)
RETURNS TABLE(
    total_purchases BIGINT,
    total_amount DECIMAL(10,2),
    successful_purchases BIGINT,
    failed_purchases BIGINT,
    last_purchase_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_purchases,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_purchases,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_purchases,
        MAX(created_at) as last_purchase_date
    FROM purchases 
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's restoration statistics
CREATE OR REPLACE FUNCTION get_user_restoration_stats(user_uuid UUID)
RETURNS TABLE(
    total_restorations BIGINT,
    successful_restorations BIGINT,
    total_credits_restored BIGINT,
    last_restoration_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_restorations,
        COUNT(*) FILTER (WHERE status = 'success') as successful_restorations,
        COALESCE(SUM(actual_credits_added), 0) as total_credits_restored,
        MAX(created_at) as last_restoration_date
    FROM credit_restorations 
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated; 
GRANT ALL ON purchases TO authenticated;
GRANT ALL ON credit_restorations TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated; 