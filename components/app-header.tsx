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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  /**
   * When set, the avatar links directly to this profile page and a separate
   * sign-out button is shown beside it (instead of the account dropdown).
   */
  profileHref?: string;
}

/**
 * Shared sticky top bar for the authenticated portals. Mirrors MOA-Client's
 * header pattern: brand on the left, role nav, and a user menu with sign-out.
 */
export function AppHeader({
  portal,
  homeHref,
  nav,
  userPrimary,
  userSecondary,
  logoutPath,
  postLogoutPath,
  profileHref,
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

  const initials = (userPrimary || portal).trim().slice(0, 2).toUpperCase();

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link
          href={homeHref}
          className="text-foreground flex flex-shrink-0 items-center gap-2"
        >
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {portal}
          </span>
        </Link>

        <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex [&::-webkit-scrollbar]:hidden">
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

        <div className="ml-auto flex items-center gap-1">
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

          {profileHref ? (
            <>
              <Link
                href={profileHref}
                title={userPrimary ?? "Profile"}
                aria-label="Profile"
                className="bg-primary/10 text-primary hover:bg-primary/15 flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors focus:outline-none"
              >
                {initials}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="text-muted-foreground hover:text-destructive"
              >
                {logout.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <LogOut />
                )}
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="bg-primary/10 text-primary hover:bg-primary/15 flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors focus:outline-none"
                >
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {userPrimary ?? portal}
                    </span>
                    {userSecondary && (
                      <span className="text-muted-foreground truncate text-xs">
                        {userSecondary}
                      </span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    logout.mutate();
                  }}
                  disabled={logout.isPending}
                  className="text-destructive focus:text-destructive"
                >
                  {logout.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <LogOut />
                  )}
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
