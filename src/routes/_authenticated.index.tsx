import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Hash, Settings, Plus, Search, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const navigate = useNavigate();
  const [activeServer, setActiveServer] = useState(0);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      {/* Column 1: Server List */}
      <div className="flex w-[72px] flex-col items-center gap-3 border-r border-border bg-background py-3">
        {[1, 2, 3].map((i) => (
          <button
            key={i}
            onClick={() => setActiveServer(i)}
            className={`group relative flex h-12 w-12 items-center justify-center rounded-[24px] transition-all duration-200 hover:rounded-[16px] ${
              activeServer === i ? "rounded-[16px] bg-primary text-primary-foreground glow-sm" : "bg-card text-muted-foreground hover:bg-primary hover:text-primary-foreground"
            }`}
          >
            <div className={`absolute -left-1 h-2 w-2 rounded-full bg-foreground transition-all ${activeServer === i ? "scale-100" : "scale-0 group-hover:scale-100"}`} />
            <span className="text-lg font-bold">L{i}</span>
          </button>
        ))}
        <div className="mx-4 h-[2px] w-8 bg-border" />
        <button className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-card text-primary transition-all hover:rounded-[16px] hover:bg-primary hover:text-primary-foreground">
          <Plus size={24} />
        </button>
      </div>

      {/* Column 2: Channels/Navigation */}
      <div className="flex w-60 flex-col border-r border-border bg-card/50">
        <div className="flex h-12 items-center border-b border-border px-4 shadow-sm">
          <h2 className="text-sm font-bold truncate">LUME COMMUNITY</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div className="space-y-1">
            <p className="px-2 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Communication</p>
            {['welcome', 'announcements', 'rules'].map(channel => (
              <button key={channel} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <Hash size={16} />
                <span>{channel}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <p className="px-2 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">General</p>
            {['lounge', 'tech-talk', 'showcase', 'gaming'].map(channel => (
              <button key={channel} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <Hash size={16} />
                <span>{channel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User Footer */}
        <div className="mt-auto flex items-center gap-3 border-t border-border bg-background/50 p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary/20 text-primary text-xs">U</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-bold">User</p>
            <p className="truncate text-[10px] text-muted-foreground">online</p>
          </div>
          <button onClick={handleSignOut} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Column 3: Main Content (Chat Placeholder) */}
      <div className="flex flex-1 flex-col bg-background">
        <div className="flex h-12 items-center border-b border-border px-4 shadow-sm">
          <Hash size={20} className="mr-2 text-muted-foreground" />
          <h3 className="text-sm font-bold">welcome</h3>
          <div className="ml-auto flex items-center gap-4 text-muted-foreground">
            <Search size={18} className="cursor-pointer hover:text-foreground" />
            <Settings size={18} className="cursor-pointer hover:text-foreground" />
            <User size={18} className="cursor-pointer hover:text-foreground" />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary glow-sm">
              <Hash size={40} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome to #welcome</h1>
            <p className="text-muted-foreground">This is the start of the #welcome channel. LUME is currently in alpha.</p>
            <div className="flex gap-2 justify-center pt-4">
              <Button variant="outline" size="sm" className="border-border">Edit Channel</Button>
              <Button size="sm">Invite Members</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
