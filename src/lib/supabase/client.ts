// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string

// Import the supabase client like this:
// import { supabase } from "@/lib/supabase/client";

// Verifica se estamos no Firebase para não sobrecarregar o browser com duas sessões brigando
const isFirebase = import.meta.env.VITE_DB_PROVIDER === 'firebase'

export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY || 'placeholder_key',
  {
    auth: {
      storage: localStorage,
      persistSession: !isFirebase, // Desliga a sessão local do Supabase se estivermos testando Firebase
      autoRefreshToken: !isFirebase,
    },
  },
)
