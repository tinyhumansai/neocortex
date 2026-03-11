"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, LogOut, MessageSquare, FileText, Gavel } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NewChatButton } from "./NewChatButton";
import { ConversationList } from "./ConversationList";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { cn } from "@/lib/utils";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isChat = pathname?.startsWith("/chat");
  const isFilings = pathname?.startsWith("/filings");
  const isCases = pathname?.startsWith("/cases");

  const handleSignOut = () => {
    signOut();
    router.push("/login");
  };

  const linkProps = (href: string) => ({
    href,
    onClick: onNavigate,
  });

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-border/80 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
          L
        </span>
        <h1 className="text-lg font-bold tracking-tight">LexAI</h1>
      </div>

      <nav className="flex flex-col gap-1 border-b border-border/80 px-2 py-2.5">
        <Link
          {...linkProps("/chat")}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isChat
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          Chat
        </Link>
        <Link
          {...linkProps("/filings")}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isFilings
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <FileText className="h-4 w-4 shrink-0" />
          Tax Filings
        </Link>
        <Link
          {...linkProps("/cases")}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isCases
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Gavel className="h-4 w-4 shrink-0" />
          Case Search
        </Link>
      </nav>

      <div className="flex-1 overflow-hidden p-3">
        {isChat && (
          <>
            <div className="mb-3">
              <NewChatButton />
            </div>
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <ConversationList />
            </ScrollArea>
          </>
        )}
        {isFilings && (
          <div className="px-2 text-sm text-muted-foreground">
            Manage your income tax filings and file ITR.
          </div>
        )}
      </div>

      <div className="border-t border-border/80 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl p-2.5 text-left hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.image ?? undefined} />
                <AvatarFallback>{user?.name?.[0] ?? user?.email?.[0] ?? "?"}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 truncate text-sm">{user?.email}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile: Header bar with Sheet trigger */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-border/80 bg-background/95 px-3 backdrop-blur lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-[260px] max-w-[85vw] flex-col gap-0 border-r border-border/80 p-0 sm:max-w-[260px]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
          L
        </span>
        <h1 className="truncate text-lg font-bold tracking-tight">LexAI</h1>
      </header>

      {/* Desktop: Fixed sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[260px] flex-col border-r border-border/80 bg-background lg:flex">
        <SidebarContent />
      </aside>
    </>
  );
}
