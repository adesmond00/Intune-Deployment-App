// Database configuration
// This file centralizes database connection settings for easier configuration
import { backblazeConfig } from "./backblaze-config"

// Default connection settings from environment variables
export const dbConfig = {
  // Supabase connection
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // Retention settings
  trashRetentionDays: 30, // Number of days to keep items in trash before automatic cleanup

  // File storage (reference to BackBlaze config)
  fileStorage: backblazeConfig,
}

// You can override these settings here for development or testing
// For production, use environment variables
