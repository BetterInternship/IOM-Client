"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,

} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, Menu, Loader2 } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
}

interface AppHeaderProps {
  portal: string;
  homeHref: string;
  nav: NavItem[];
  userPrimary?: string;
  userSecondary?: string;
  logoutPath: string;
  postLogoutPath: string;
}

/**
 * Shared sticky top bar for the authenticated portals. Mirrors MOA-Client's
 * header pattern: brand on the left, role nav, and a user menu with sign-out.
 */
export function AppHeader({
  nav,
  userPrimary,
  logoutPath,
  postLogoutPath,
}: AppHeaderProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = useMutation({
    mutationFn: () => preconfiguredAxios.post(logoutPath),
    onSettled: () => {
      queryClient.clear();
      router.replace(postLogoutPath);
    },
  });

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex [&::-webkit-scrollbar]:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex-shrink-0 rounded-[0.33em] px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {nav.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" aria-label="Open navigation">
                  <Menu />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {nav.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {userPrimary && (
            <>
              <span className="text-muted-foreground hidden max-w-[180px] truncate text-sm sm:block">
                {userPrimary}
              </span>
              <div className="bg-border hidden h-4 w-px flex-shrink-0 sm:block" />
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            aria-label="Logout"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="text-muted-foreground hover:text-destructive"
          >
            {logout.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <LogOut />
            )}
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
