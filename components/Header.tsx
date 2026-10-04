"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { usePathname, useRouter } from "next/navigation";

import { navSections } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth/auth-context";
import { CRM_STANDARD_USER_PATHS, getRoleLabel, isCrmAdmin } from "@/lib/auth/roles";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onMenuToggle: () => void;
  showMenuButton?: boolean;
}

const pageTitles: Record<string, string> = {
  "/chat": "Chat",
  "/contacto": "Contacto",
  "/conexiones": "Conexiones",
  "/configuracion": "Configuracion",
  "/etiquetas": "Etiquetas",
  "/reportes": "Reportes",
  "/empresa": "Empresa",
};

export function Header({ onMenuToggle, showMenuButton = true }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user, logout } = useAuth();
  const userIsAdmin = isCrmAdmin(user?.rol);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setIsSearchOpen(false);
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const modalFilteredSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (!userIsAdmin && !CRM_STANDARD_USER_PATHS.includes(item.href as (typeof CRM_STANDARD_USER_PATHS)[number])) return false;
            if (!searchQuery.trim()) return true;

            const query = searchQuery.toLowerCase();
            return (
              item.label.toLowerCase().includes(query) ||
              item.href.toLowerCase().includes(query) ||
              section.subtitle.toLowerCase().includes(query)
            );
          }),
        }))
        .filter((section) => section.items.length > 0),
    [searchQuery, userIsAdmin],
  );

  const totalModules = navSections
    .flatMap((section) => section.items)
    .filter((item) => userIsAdmin || CRM_STANDARD_USER_PATHS.includes(item.href as (typeof CRM_STANDARD_USER_PATHS)[number])).length;
  const title = pageTitles[pathname] ?? "Panel";
  const sectionLabel = pathname.startsWith("/reportes") ? "Reportes" : "CRM";

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  const userName = [user?.nombre, user?.apellido].filter(Boolean).join(" ") || "Usuario CRM";
  const userEmail = user?.correo ?? "Sesion activa";
  const roleLabel = getRoleLabel(user?.rol);
  const nameParts = userName.split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || (firstName.charAt(1) ?? "");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[oklch(0.13_0_0/.95)]">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {showMenuButton && (
              <button
                onClick={onMenuToggle}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
                aria-label="Abrir menu"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
            )}

            <div className="flex min-w-0 items-center gap-2">
              <span className="hidden shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-widest text-blue-600 sm:inline-flex dark:bg-blue-500/10 dark:text-blue-400">
                {sectionLabel}
              </span>
              <span className="hidden h-4 w-px bg-slate-200 sm:block dark:bg-white/10" />
              <h1 className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-600 lg:flex dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-slate-300"
            >
              <MagnifyingGlassIcon className="h-4 w-4 shrink-0" />
              <span className="w-64 text-left text-xs">Buscar modulo...</span>
              <span className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-medium text-slate-400 dark:border-white/10 dark:bg-white/5">
                Ctrl K
              </span>
            </button>

            <ThemeToggle
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            />

            <span className="mx-0.5 hidden h-5 w-px bg-slate-200 sm:block dark:bg-white/10" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1 outline-none ring-blue-500/40 transition-colors hover:bg-slate-100 focus-visible:ring-2 dark:hover:bg-white/10"
                  aria-label="Menu de usuario"
                >
                  <div className="relative shrink-0">
                    <UserAvatar
                      nombre={firstName}
                      apellido={lastName}
                      className="h-8 w-8 ring-2 ring-slate-200 transition-all group-hover:ring-slate-300 dark:ring-white/10 dark:group-hover:ring-white/20"
                      fallbackClassName="bg-gradient-to-br from-slate-500 to-slate-700 text-white"
                      textClassName="text-[11px] font-bold"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-[oklch(0.13_0_0)]" />
                  </div>
                  <div className="hidden min-w-0 max-w-[140px] text-left leading-none sm:block">
                    <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                      {userName}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-blue-600 dark:text-blue-400">
                      {userEmail}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-64 overflow-hidden p-0"
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 bg-gradient-to-br from-slate-50 to-blue-50/40 p-4 dark:from-white/[0.03] dark:to-blue-500/5">
                    <div className="relative shrink-0">
                      <UserAvatar
                        nombre={firstName}
                        apellido={lastName}
                        className="h-11 w-11 ring-2 ring-slate-200 dark:ring-white/10"
                        fallbackClassName="bg-gradient-to-br from-slate-500 to-slate-700 text-white"
                        textClassName="text-xs font-bold"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-[hsl(var(--popover))]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">
                        {userName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {userEmail}
                      </p>
                      <span className="mt-1.5 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="my-0" />

                <div className="p-1">
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-rose-600 focus:bg-rose-50 focus:text-rose-700 dark:text-rose-400 dark:focus:bg-rose-500/10 dark:focus:text-rose-300"
                  >
                    <ArrowRightStartOnRectangleIcon className="h-4 w-4 shrink-0" />
                    <span>Cerrar sesion</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {isSearchOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-20">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeSearch}
          />

          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(0,0,0,0.18)] dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-700/60">
              <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar modulo o pagina..."
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto py-2">
              {modalFilteredSections.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  Sin resultados para &quot;{searchQuery}&quot;
                </p>
              ) : (
                modalFilteredSections.map((section) => (
                  <div key={section.subtitle} className="mb-1">
                    <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {section.subtitle}
                    </p>
                    {section.items.map((item) => {
                      const active =
                        pathname === item.href ||
                        (item.href !== "/chat" && pathname.startsWith(`${item.href}/`));
                      const Icon = active ? item.iconActive : item.icon;

                      return (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => {
                            closeSearch();
                            router.push(item.href);
                          }}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                            active
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              active ? "text-blue-500 dark:text-blue-400" : "text-slate-400"
                            }`}
                          />
                          <span className="flex-1 text-left">{item.label}</span>
                          {active && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                              Activo
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
              {totalModules} modulos disponibles - Ctrl K para abrir/cerrar
            </div>
          </div>
        </div>
      )}
    </>
  );
}
