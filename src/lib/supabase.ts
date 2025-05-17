import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ActivityLog = {
  id: string;
  user_id: number | null;
  event_type: 'API_CALL' | 'ERROR' | 'AUTH' | 'SYSTEM';
  action: string;
  details: Record<string, any>;
  status: 'SUCCESS' | 'ERROR';
  created_at: string;
};

export type Endorsement = {
  id: number;
  username: string;
  category_id: number;
  note: string | null;
  endorsed_by: string;
  trust_level: number;
  timestamp: string;
};

export async function logActivity(
  event_type: ActivityLog['event_type'],
  action: string,
  details: Record<string, any> = {},
  status: ActivityLog['status'] = 'SUCCESS',
  user_id?: number
) {
  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert([
        {
          user_id,
          event_type,
          action,
          details,
          status
        }
      ]);

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

export async function createEndorsement(
  username: string,
  category: string,
  note: string | null,
  endorsed_by: string,
  trust_level: number
) {
  try {
    // First, get the category ID
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category)
      .single();

    if (categoryError) {
      throw new Error(`Failed to get category ID: ${categoryError.message}`);
    }

    // Create the endorsement
    const { data, error } = await supabase
      .from('endorsements')
      .insert([
        {
          username,
          category_id: categoryData.id,
          note,
          endorsed_by,
          trust_level
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create endorsement: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error creating endorsement:', error);
    throw error;
  }
}

export async function getEndorsements(username: string) {
  try {
    const { data, error } = await supabase
      .from('endorsements')
      .select(`
        *,
        categories (
          name
        )
      `)
      .eq('username', username)
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to get endorsements: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error getting endorsements:', error);
    throw error;
  }
}