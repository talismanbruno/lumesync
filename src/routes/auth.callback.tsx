import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/auth/callback')({
  loader: async ({ search }) => {
    // Check if we have an access token in the hash (Supabase client handles this usually, 
    // but the route needs to exist to process the redirect)
    
    // If it's a code-based flow:
    const code = (search as any).code
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[Lume Auth] Error exchanging code:', error)
        throw redirect({ to: '/auth', search: { error: 'invalid_link' } as any })
      }
    }

    // After exchange or if it was a fragment-based redirect, the session 
    // will be picked up by the Supabase client and AuthContext.
    throw redirect({ to: '/' })
  }
})
