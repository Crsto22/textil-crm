"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Header } from "@/components/Header";
import { Sidebar, navSections } from "@/components/Sidebar";
import { LoaderOverlay } from "@/components/ui/loader-overlay";
import { useAuth } from "@/lib/auth/auth-context";
import { CRM_STANDARD_USER_PATHS, hasCrmAccess, isCrmAdmin, isCrmStandardUserPath } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

function MobileBottomNav({ hidden, isAdmin }: { hidden: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navSections.flatMap((section) => section.items).filter(
    (item) => (isAdmin || CRM_STANDARD_USER_PATHS.includes(item.href as (typeof CRM_STANDARD_USER_PATHS)[number])) && item.href !== "/reportes"
  );

  const isActive = (href: string) =>
    pathname === href || (href !== "/chat" && pathname.startsWith(`${href}/`));

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_28px_rgba(15,23,42,0.10)] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-slate-950/95 dark:shadow-[0_-10px_28px_rgba(0,0,0,0.35)]",
        hidden ? "hidden" : "",
      )}
      aria-label="Navegacion principal"
    >
      <div className="grid grid-cols-4 gap-1">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = active ? item.iconActive : item.icon;

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              disabled={item.disabled}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-semibold transition-colors",
                active
                  ? "text-slate-950 dark:text-white"
                  : "text-slate-500 active:bg-slate-100 dark:text-slate-400 dark:active:bg-white/10",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={cn(
                  "relative flex h-9 min-w-14 items-center justify-center rounded-full px-4 transition-colors",
                  active
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "text-slate-700 dark:text-slate-300",
                )}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="w-full truncate text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isChatPage = pathname === "/chat";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hideChatMobileChrome, setHideChatMobileChrome] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isChatPage);
  const previousPathnameRef = useRef(pathname);
  const userIsAdmin = isCrmAdmin(user?.rol);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace("/");
      return;
    }

    if (!hasCrmAccess(user)) {
      router.replace("/");
      return;
    }

    if (!userIsAdmin && !isCrmStandardUserPath(pathname)) {
      router.replace("/chat");
    }
  }, [isLoading, isAuthenticated, user, userIsAdmin, pathname, router]);

  useEffect(() => {
    if (pathname === previousPathnameRef.current) return;
    previousPathnameRef.current = pathname;

    if (pathname === "/chat") {
      const frame = window.requestAnimationFrame(() => {
        setSidebarCollapsed(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isChatPage) return;

    const handleChatMobileView = (event: Event) => {
      const customEvent = event as CustomEvent<{ conversationOpen?: boolean }>;
      setHideChatMobileChrome(Boolean(customEvent.detail?.conversationOpen));
    };

    window.addEventListener("crm:chat-mobile-view", handleChatMobileView);

    return () => {
      window.removeEventListener("crm:chat-mobile-view", handleChatMobileView);
    };
  }, [isChatPage]);

  if (isLoading) return <LoaderOverlay />;
  if (!isAuthenticated || !hasCrmAccess(user)) return null;
  if (!userIsAdmin && !isCrmStandardUserPath(pathname)) return <LoaderOverlay />;

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="max-md:hidden">
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        />
      </div>
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-[88px]" : "lg:ml-[260px]"
        }`}
      >
        <div className={cn(hideChatMobileChrome ? "max-md:hidden" : "")}>
          <Header onMenuToggle={() => setSidebarOpen(true)} showMenuButton={false} />
        </div>
        <main
          className={cn(
            "flex-1 bg-gray-50 dark:bg-[oklch(0.1_0_0)]",
            isChatPage ? "overflow-hidden p-0" : "overflow-y-auto p-6",
            !hideChatMobileChrome ? "max-md:pb-24" : "",
          )}
        >
          {children}
        </main>
      </div>
      <MobileBottomNav hidden={hideChatMobileChrome} isAdmin={userIsAdmin} />
    </div>
  );
}
