import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Lovable Generated Project" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Lovable Generated Project" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [isInitializing, setIsInitializing] = useState(true);
  const [debugInfo, setDebugInfo] = useState<{
    session: any;
    user: any;
    profile: any;
    error: any;
  }>({ session: null, user: null, profile: null, error: null });
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!mounted) return;
        setDebugInfo(prev => ({ ...prev, session, user: session?.user }));
        console.log("[Lume Auth] User ID:", session?.user?.id);

        if (!session) {
          if (window.location.pathname !== "/auth") {
            router.navigate({ to: "/auth" });
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("[Lume Auth] Profile fetch error:", profileError);
        }

        if (!mounted) return;
        setDebugInfo(prev => ({ ...prev, profile }));
        console.log("[Lume Auth] Profile:", profile);

        if (!profile?.username) {
          router.navigate({ to: "/onboarding" });
        } else if (window.location.pathname === "/auth" || window.location.pathname === "/onboarding") {
          router.navigate({ to: "/" });
        }
      } catch (error) {
        console.error("[Lume Auth Error]", error);
        setDebugInfo(prev => ({ ...prev, error }));
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Lume Auth] Event:", event);
      router.invalidate();
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        checkAuth();
      } else if (event === "SIGNED_OUT") {
        setDebugInfo({ session: null, user: null, profile: null, error: null });
        setIsInitializing(false);
        router.navigate({ to: "/auth" });
      }
    });

    checkAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.reload();
  };

  if (isInitializing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] p-6 text-white font-sans">
        <div className="w-full max-w-lg space-y-8 rounded-2xl border border-white/10 bg-[#121212] p-8 shadow-2xl glow-sm">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tighter text-[#00D1FF]">LUME</h1>
            <p className="text-zinc-500">Painel de Diagnóstico</p>
          </div>
          
          <div className="space-y-4 text-sm font-mono">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-zinc-500">Session:</span>
              <span className={debugInfo.session ? "text-emerald-400" : "text-red-400"}>
                {debugInfo.session ? "Active" : "Null"}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-zinc-500">User ID:</span>
              <span className="text-zinc-300 truncate max-w-[200px]">{debugInfo.user?.id || "Nenhum"}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-zinc-500">Username:</span>
              <span className={debugInfo.profile?.username ? "text-emerald-400" : "text-amber-400"}>
                {debugInfo.profile?.username || "Não encontrado"}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-zinc-500">Loading:</span>
              <span className="text-[#00D1FF]">{isInitializing ? "true" : "false"}</span>
            </div>
            {debugInfo.error && (
              <div className="rounded bg-red-500/10 p-2 text-red-400 text-xs">
                Error: {debugInfo.error.message || JSON.stringify(debugInfo.error)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => setIsInitializing(false)}
              className="flex items-center justify-center rounded-lg bg-[#00D1FF] px-4 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] glow-sm"
            >
              Forçar Entrada
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Limpar Sessão / Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" theme="dark" richColors />
    </QueryClientProvider>
  );
}
