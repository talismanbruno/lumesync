import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/auth/callback')({
  component: () => null,
  loader: async ({ search }: { search: Record<string, any> }) => {
    const code = search.code
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[Lume Auth] Error exchanging code:', error)
        throw redirect({ to: '/auth' })
      }
    }

    throw redirect({ to: '/' })
  }
})
