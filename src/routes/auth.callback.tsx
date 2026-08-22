import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { z } from 'zod'

const searchSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
})

export const Route = createFileRoute('/auth/callback')({
  validateSearch: (search) => searchSchema.parse(search),
  loader: async ({ search }) => {
    const code = search.code
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[Lume Auth] Error exchanging code:', error)
        throw redirect({ to: '/auth' })
      }
    }

    throw redirect({ to: '/' })
  },
  component: () => null
})
