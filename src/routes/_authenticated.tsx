import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", session.user.id)
      .single();
      
    if (!profile?.username) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: () => <Outlet />,
});
