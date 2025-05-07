import { createClient } from "@supabase/supabase-js"
import { dbConfig } from "./db-config"

// Create a Supabase client with the service role key for server operations
export const createServerSupabaseClient = () => {
  return createClient(dbConfig.supabaseUrl, dbConfig.supabaseServiceKey)
}
