import React, { createContext, useContext, useEffect, useState, useRef } from "react";
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
  const mountedRef = useRef(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data && mountedRef.current) {
        setProfile(data as Profile);
      } else if (mountedRef.current) {
        console.log("[Lume Auth] Profile not found for user:", userId);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsAuthChecking(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const initAuth = async () => {
      // Start checking
      setIsAuthChecking(true);
      
      // Try to get session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (!mountedRef.current) return;

      if (error) {
        console.error("[Lume Auth] getSession error:", error);
        setIsLoading(false);
        setIsAuthChecking(false);
        return;
      }

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        // We have a user, fetch their profile before ending the check
        await fetchProfile(currentUser.id);
      } else {
        // No user, we can end the check
        setIsLoading(false);
        setIsAuthChecking(false);
      }
    };

    initAuth();

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;
      
      const currentUser = session?.user ?? null;
      
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || (event === 'INITIAL_SESSION' && currentUser)) {
        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        setIsAuthChecking(false);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const updateProfile = async (updates: { display_name?: string | null; bio?: string | null; avatar_url?: string | null; banner_url?: string | null }) => {
    if (!user) return;
    
    // 1. Otimistic Update
    setProfile((prev: any) => ({ ...prev, ...updates }));
    
    // 2. Persist
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
      
    if (error) {
      console.error("Erro ao salvar perfil:", error);
      toast.error("Erro ao salvar dados no banco");
      refreshProfile();
      return;
    }
    
    if (data && mountedRef.current) {
      setProfile(data as Profile);
      toast.success("Perfil atualizado com sucesso!");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (mountedRef.current) {
      setUser(null);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isAuthChecking, updateProfile, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

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