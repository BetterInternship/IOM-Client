"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LogOut,
  Menu,
  X,
  Loader2,
  UserRound,
  ChevronDown,
  ChevronRight,
  Handshake,
  Mail,
  History,
  FileText,
  Users,
  LayoutDashboard,
  FilePlus,
  GraduationCap,
  Building2,
  SearchCheck,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
  icon?: LucideIcon;
}

interface AppHeaderProps {
  portal: string;
  homeHref: string;
  nav: NavItem[];
  userPrimary?: string;
  userSecondary?: string;
  logout: () => Promise<unknown>;
  postLogoutPath: string;
  profileHref?: string;
  userAvatarUrl?: string | null;
}

function labelIcon(label: string): LucideIcon {
  const map: Record<string, LucideIcon> = {
    Partners: Handshake,
    Invites: Mail,
    Invitations: Mail,
    Accounts: Users,
    "Activity Log": History,
    "MOA Templates": FileText,
    Universities: GraduationCap,
    Companies: Building2,
    "Company Reviews": SearchCheck,
    "Request MOA": FilePlus,
    Dashboard: LayoutDashboard,
  };
  return map[label] ?? Handshake;
}

export function AppHeader({
  portal,
  homeHref,
  nav,
  userPrimary,
  logout: logoutFn,
  postLogoutPath,
  profileHref,
  userAvatarUrl,
}: AppHeaderProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  const logout = useMutation({
    mutationFn: logoutFn,
    onSettled: () => {
      queryClient.clear();
      router.replace(postLogoutPath);
    },
  });

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="bg-background/70 sticky top-0 z-40 border-b py-2 backdrop-blur">
      <div className="mx-auto flex h-16 items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          href={homeHref}
          className="block flex-shrink-0 border-none text-black! outline-none focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <Image
              src="/betterinternship-logo.png"
              alt=""
              width={25}
              height={25}
              className="flex-none"
            />
            <h1 className="font-display flex flex-row items-center space-x-2 text-lg font-bold text-gray-900">
              Partners
              <span className="ml-2 mt-0.5 rounded-[0.33em] border border-gray-200 bg-gray-50 p-1 text-xs font-medium text-gray-400 leading-none">
                {portal}
              </span>
            </h1>
          </div>
        </Link>

        {/* Desktop right side: nav buttons + user */}
        <div className="hidden flex-1 items-center justify-end gap-2 md:flex">
          {nav.map((item) => {
            const Icon = item.icon ?? labelIcon(item.label);
            return (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "relative h-auto min-w-0 flex-col items-center justify-center gap-1 rounded-[0.33em] px-3 py-1",
                  isActive(item.href)
                    ? "text-primary"
                    : "opacity-80 hover:bg-gray-100 hover:opacity-100"
                )}
                onClick={() => router.push(item.href)}
              >
                <Icon className="!h-6 !w-6" strokeWidth={1.7} />
                <span className="text-xs">{item.label}</span>
                {!!item.badge && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold leading-none text-amber-900">
                    !
                  </span>
                )}
              </Button>
            );
          })}

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="group h-auto min-w-24 flex-col items-stretch justify-center gap-0 rounded-[0.33em] p-0 hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-2 rounded-[0.33em] border border-gray-300 p-2 px-3 text-xs">
                  {userAvatarUrl ? (
                    <img
                      src={userAvatarUrl}
                      alt=""
                      className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200 object-contain"
                    />
                  ) : (
                    <UserRound className="h-4 w-4 shrink-0 text-gray-500" />
                  )}
                  <span className="max-w-[120px] truncate font-medium">
                    {userPrimary ?? "Account"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-max min-w-44">
              {userPrimary && (
                <div className="px-2 py-1.5">
                  <div className="text-center text-sm font-medium">{userPrimary}</div>
                </div>
              )}
              <DropdownMenuSeparator />
              {profileHref && (
                <DropdownMenuItem asChild>
                  <Link href={profileHref}>
                    <UserRound className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
              >
                <LogOut className="h-4 w-4" />
                {logout.isPending ? "Logging out..." : "Sign Out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={isDrawerOpen ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 hover:bg-gray-50 md:hidden"
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        >
          {isDrawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile right drawer */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-[30] duration-200 md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed top-0 right-0 z-[31] h-[100svh] w-full max-w-[92%] border-l border-gray-200 bg-white shadow-xl sm:max-w-[420px] md:hidden",
          "transition-transform duration-250 ease-out",
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile menu"
      >
        <div className="flex h-full flex-col">
          <div className="mt-1 flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Image src="/betterinternship-logo.png" alt="" width={25} height={25} className="h-6 w-6 rounded object-contain" />
              <span className="text-sm font-semibold">Partners</span>
              <span className="rounded border border-gray-200 bg-gray-50 px-1 py-0 text-[10px] font-medium text-gray-400 leading-none">{portal}</span>
            </div>
            <button
              type="button"
              aria-label="Close menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
              onClick={() => setIsDrawerOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {userPrimary && (
              <div className="flex items-center gap-2 pb-2">
                <UserRound className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-semibold text-gray-900">{userPrimary}</span>
              </div>
            )}

            <Separator className="my-4" />

            <nav className="space-y-1">
              {nav.map((item) => {
                const Icon = item.icon ?? labelIcon(item.label);
                return (
                  <Link key={item.href} href={item.href} className="block w-full">
                    <button className="flex w-full items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm transition-colors hover:border-gray-200 hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-500" />
                        <span>{item.label}</span>
                        {!!item.badge && (
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold leading-none text-amber-900">
                            !
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </button>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto border-t px-4 py-3 space-y-1">
            {profileHref && (
              <Link href={profileHref} className="block w-full">
                <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-50">
                  <UserRound className="h-4 w-4" />
                  Profile
                </button>
              </Link>
            )}
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-md py-2 font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              {logout.isPending ? "Logging out..." : "Sign Out"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
