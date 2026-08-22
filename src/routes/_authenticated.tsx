import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  loader: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw redirect({ to: "/auth" });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!profile?.username) {
        throw redirect({ to: "/onboarding" });
      }

      return { session, profile };
    } catch (e) {
      if (isRedirect(e) || e instanceof Response) throw e;
      throw redirect({ to: "/auth" });
    }
  },
  head: () => ({
    meta: [
      { title: "Lume" },
      { name: "description", content: "Lume" },
      { property: "og:title", content: "Lume" },
      { property: "og:description", content: "Lume" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", type: "image/png", href: "https://i.ibb.co/99YTNvGS/image.png" }],
  }),
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#050505] text-zinc-100">
      <Outlet />
    </div>
  );
}
