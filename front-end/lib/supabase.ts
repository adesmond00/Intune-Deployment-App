import { createClient } from "@supabase/supabase-js"
import { dbConfig } from "./db-config"

// Create a single supabase client for the browser
export const supabase = createClient(dbConfig.supabaseUrl, dbConfig.supabaseAnonKey)

// Types for our database tables
export interface App {
  id: string
  app_id: string
  name: string
  publisher: string
  description: string | null
  category: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AppVersion {
  id: string
  app_id: string
  version: string
  version_id: string
  release_notes: string | null
  detection_script: string | null
  path: string | null
  is_current: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  description: string | null
  install_command: string | null
  uninstall_command: string | null
}

export interface Deployment {
  id: string
  app_version_id: string
  status: "success" | "failed" | "pending"
  intune_app_id: string | null
  error_message: string | null
  deployed_at: string
}
