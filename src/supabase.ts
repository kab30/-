import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnnowmstroiedocubvjv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubm93bXN0cm9pZWRvY3Vidmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjM1NzgsImV4cCI6MjA4ODYzOTU3OH0.-Y9zZ0NlPNFyfgwiCtjGHNd0eHhOWIpnFLlp0j8Ao2U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Novel {
  id: string;
  title: string;
  original_title?: string;
  source_url?: string;
  cover_url: string;
  total_chapters?: number;
  notes?: string;
  created_at: string;
}

export interface Chapter {
  id: string;
  novel_id: string;
  order_index: number;
  title: string;
  content_original: string;
  content_arabic: string | null;
  created_at: string;
}

export interface CleaningRule {
  id: string;
  novel_id: string;
  pattern: string;
  replacement: string;
  is_regex: boolean;
  created_at: string;
}

export interface CleaningLog {
  id: string;
  novel_id: string;
  operation_type: string;
  target: string;
  rules_applied: any;
  stats: Record<string, number>;
  created_at: string;
}

export interface CleaningLogDetail {
  id: string;
  log_id: string;
  chapter_id: string;
  old_content_original: string | null;
  old_content_arabic: string | null;
}
