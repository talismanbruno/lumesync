import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;

  status?: 'online' | 'idle' | 'dnd' | 'offline';
  is_admin?: boolean;
  is_verified?: boolean;
  created_at?: string;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthChecking: boolean;
  updateProfile: (updates: { display_name?: string | null; bio?: string | null; avatar_url?: string | null; banner_url?: string | null }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfile(data as Profile);
      } else {
        // Fallback for when trigger hasn't run yet or profile doesn't exist
        console.log("[Lume Auth] Profile not found, will retry or wait for trigger");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setIsLoading(false);
        setIsAuthChecking(false);
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && currentUser)) {
        if (currentUser) {
          fetchProfile(currentUser.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setIsLoading(false);
        setIsAuthChecking(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const updateProfile = async (updates: { display_name?: string | null; bio?: string | null; avatar_url?: string | null; banner_url?: string | null }) => {
    if (!user) return;
    
    // 1. Atualização Otimista Imediata no Estado Global (Todas as telas mudam na hora)
    setProfile((prev: any) => ({ ...prev, ...updates }));
    
    // 2. Persistência no Banco Supabase
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
      
    if (error) {
      console.error("Erro ao salvar perfil:", error);
      toast.error("Erro ao salvar dados no banco");
      // Rollback optimistic update if needed or refetch
      refreshProfile();
      return;
    }
    
    if (data) {
      setProfile(data as Profile);
      toast.success("Perfil atualizado com sucesso!");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isAuthChecking, updateProfile, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// Fallback used if a component renders outside the provider (e.g. during a
// hot-reload boundary). Prevents a hard crash / blank screen.
const fallbackAuth: AuthContextType = {
  user: null,
  profile: null,
  isLoading: true,
  isAuthChecking: true,
  updateProfile: async (updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    if (error) toast.error("Erro ao salvar dados no banco");
  },
  signOut: async () => {
    await supabase.auth.signOut();
  },
  refreshProfile: async () => {},
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.warn("[Lume] useAuth used outside AuthProvider — using fallback context.");
    return fallbackAuth;
  }
  return context;

}
