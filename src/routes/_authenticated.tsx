import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  loader: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      console.log("[Lume Auth Protected] Checking session:", session?.user?.id);
      
      if (!session) {
        throw redirect({ to: "/auth" });
      }
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
        
      if (error) {
        console.error("[Lume Auth Protected] Profile error:", error);
      }
        
      if (!profile?.username) {
        console.log("[Lume Auth Protected] No username, redirecting to onboarding");
        throw redirect({ to: "/onboarding" });
      }

      return { session, profile };
    } catch (e) {
      // Redirects thrown by the router must bubble up untouched
      if (isRedirect(e) || e instanceof Response) throw e;
      console.error("[Lume Auth Protected] Loader error:", e);
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
