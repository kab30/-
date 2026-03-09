-- SQL for Supabase SQL Editor

-- Create Novels table
CREATE TABLE IF NOT EXISTS novels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    cover_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Chapters table
CREATE TABLE IF NOT EXISTS chapters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    novel_id UUID REFERENCES novels(id) ON DELETE CASCADE NOT NULL,
    chapter_number INTEGER NOT NULL,
    title TEXT,
    content_original TEXT NOT NULL,
    content_arabic TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(novel_id, chapter_number)
);

-- Enable Row Level Security (RLS)
ALTER TABLE novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

-- Create policies (Allowing all for simplicity in this setup, but should be restricted in production)
CREATE POLICY "Allow public read access" ON novels FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON novels FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON novels FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON novels FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON chapters FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON chapters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON chapters FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON chapters FOR DELETE USING (true);
