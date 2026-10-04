"use client";

import { useEffect, useState, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BuildingOffice2Icon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  Cog6ToothIcon,
  HomeModernIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  TagIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  BuildingOffice2Icon as BuildingOffice2IconSolid,
  ChartBarIcon as ChartBarIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  LinkIcon as LinkIconSolid,
  TagIcon as TagIconSolid,
  UserGroupIcon as UserGroupIconSolid,
} from "@heroicons/react/24/solid";
import { useAuth } from "@/lib/auth/auth-context";
import { CRM_STANDARD_USER_PATHS, isCrmAdmin } from "@/lib/auth/roles";

interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export interface SidebarItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  iconActive: ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface SidebarSection {
  subtitle: string;
  items: SidebarItem[];
}

export const navSections: SidebarSection[] = [
  {
    subtitle: "CRM",
    items: [
      {
        label: "Chat",
        href: "/chat",
        icon: ChatBubbleLeftRightIcon,
        iconActive: ChatBubbleLeftRightIconSolid,
      },
        {
          label: "Contacto",
          href: "/contacto",
          icon: UserGroupIcon,
          iconActive: UserGroupIconSolid,
        },
        {
          label: "Conexiones",
          href: "/conexiones",
          icon: LinkIcon,
          iconActive: LinkIconSolid,
        },
        {
          label: "Configuracion",
          href: "/configuracion",
          icon: Cog6ToothIcon,
          iconActive: Cog6ToothIconSolid,
        },
        {
          label: "Etiquetas",
          href: "/etiquetas",
          icon: TagIcon,
          iconActive: TagIconSolid,
        },
        {
          label: "Reportes",
          href: "/reportes",
          icon: ChartBarIcon,
          iconActive: ChartBarIconSolid,
        },
        {
          label: "Empresa",
          href: "/empresa",
          icon: BuildingOffice2Icon,
          iconActive: BuildingOffice2IconSolid,
        },
    ],
  },
];

const SIDEBAR_STORAGE_KEY = "textil-crm.sidebar.preferences.v1";

const getDefaultSectionState = () =>
  navSections.reduce<Record<string, boolean>>((state, section) => {
    state[section.subtitle] = true;
    return state;
  }, {});

const getStoredExpandedSections = () => {
  if (typeof window === "undefined") {
    return getDefaultSectionState();
  }

  try {
    const rawPrefs = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!rawPrefs) {
      return getDefaultSectionState();
    }

    const parsedPrefs = JSON.parse(rawPrefs) as {
      expandedSections?: Record<string, boolean>;
    };

    if (parsedPrefs.expandedSections && typeof parsedPrefs.expandedSections === "object") {
      return { ...getDefaultSectionState(), ...parsedPrefs.expandedSections };
    }
  } catch {
    return getDefaultSectionState();
  }

  return getDefaultSectionState();
};

export function Sidebar({
  isOpen,
  collapsed,
  onClose,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const userIsAdmin = isCrmAdmin(user?.rol);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    getStoredExpandedSections,
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        JSON.stringify({ expandedSections }),
      );
    } catch {
      return;
    }
  }, [expandedSections]);

  const effectiveSearchTerm = collapsed ? "" : searchTerm;
  const normalizedQuery = effectiveSearchTerm.trim().toLowerCase();

  const matchQuery = (item: SidebarItem) =>
    normalizedQuery.length === 0 ||
    item.label.toLowerCase().includes(normalizedQuery) ||
    item.href.toLowerCase().includes(normalizedQuery);

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        (userIsAdmin || CRM_STANDARD_USER_PATHS.includes(item.href as (typeof CRM_STANDARD_USER_PATHS)[number]))
        && matchQuery(item)),
    }))
    .filter((section) => section.items.length > 0);

  const showNoResults = normalizedQuery.length > 0 && filteredSections.length === 0;

  const handleNav = (item: SidebarItem) => {
    if (item.disabled) {
      return;
    }

    router.push(item.href);
    onClose();
  };

  const toggleSection = (subtitle: string) => {
    setExpandedSections((current) => ({
      ...current,
      [subtitle]: !current[subtitle],
    }));
  };

  const matchesPath = (href: string) =>
    pathname === href || (href !== "/chat" && pathname.startsWith(`${href}/`));

  const activeHref =
    navSections
      .flatMap((section) => section.items)
      .filter((item) => matchesPath(item.href))
      .sort((current, next) => next.href.length - current.href.length)[0]?.href ?? null;

  const isActive = (href: string) => activeHref === href;

  const itemClass = (active: boolean, disabled = false) =>
    [
      "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
      collapsed ? "justify-center" : "",
      disabled ? "cursor-not-allowed text-slate-500 opacity-70" : "",
      active
        ? "bg-gradient-to-r from-white to-slate-100 text-slate-900 shadow-[0_8px_22px_rgba(15,23,42,0.28)]"
        : disabled
          ? ""
          : "text-slate-300 hover:bg-white/[0.08] hover:text-white",
    ].join(" ");

  const renderNavItem = (item: SidebarItem) => {
    const active = isActive(item.href);
    const Icon = active ? item.iconActive : item.icon;

    return (
      <div key={item.href} className="relative">
        <button
          onClick={() => handleNav(item)}
          className={itemClass(active, item.disabled)}
          title={collapsed ? item.label : undefined}
          aria-current={active ? "page" : undefined}
          disabled={item.disabled}
        >
          <span
            className={`absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full transition-all duration-200 ${
              active ? "bg-blue-500 opacity-100" : "bg-slate-500 opacity-0 group-hover:opacity-70"
            }`}
          />
          <Icon className={`h-5 w-5 shrink-0 ${active ? "text-blue-600" : ""}`} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </button>
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen overflow-visible flex flex-col border-r rounded-r-2xl
          border-slate-800/50 bg-slate-900 text-slate-100
          shadow-[0_12px_30px_rgba(0,0,0,0.3)] transition-all duration-300 ease-in-out
          ${collapsed ? "lg:w-[88px]" : "lg:w-[260px]"}
          ${isOpen ? "w-[260px] translate-x-0" : "w-[260px] -translate-x-full lg:translate-x-0"}
        `}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-slate-700/50 ${
            collapsed ? "justify-center px-0" : "justify-between px-4"
          }`}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "min-w-0 gap-3"}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg">
              <HomeModernIcon className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-white">
                  Kiments CRM
                </p>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-1 ${collapsed ? "lg:hidden" : ""}`}>
            <button
              onClick={onToggleCollapse}
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:flex"
              title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
              aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            >
              <ChevronLeftIcon
                className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
              />
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Cerrar menu"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="absolute -right-4 top-5 hidden h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition-colors hover:text-white lg:flex"
            title="Expandir sidebar"
            aria-label="Expandir sidebar"
          >
            <ChevronLeftIcon className="h-4 w-4 rotate-180" />
          </button>
        )}

        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
          {!collapsed && (
            <div className="mb-4 px-1">
              <label htmlFor="sidebar-search" className="sr-only">
                Buscar modulo
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="sidebar-search"
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar modulo..."
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-800/70 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-slate-500"
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            {filteredSections.map((section, sectionIndex) => {
              const sectionIsOpen =
                collapsed ||
                normalizedQuery.length > 0 ||
                expandedSections[section.subtitle] !== false;

              return (
                <section key={section.subtitle} className="space-y-1.5">
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.subtitle)}
                      className="flex w-full items-center justify-between px-2 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-300"
                    >
                      <span>{section.subtitle}</span>
                      <ChevronDownIcon
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          sectionIsOpen ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                    </button>
                  )}

                  {sectionIsOpen && (
                    <div className="space-y-1">
                      {section.items.map((item) => renderNavItem(item))}
                    </div>
                  )}

                  {sectionIndex < filteredSections.length - 1 && (
                    <div className="px-2 pt-2">
                      <div className="border-t border-slate-700/50" />
                    </div>
                  )}
                </section>
              );
            })}

            {showNoResults && !collapsed && (
              <div className="rounded-xl border border-slate-700/70 bg-slate-800/60 px-3 py-3 text-xs text-slate-400">
                No se encontraron modulos para &quot;{effectiveSearchTerm}&quot;.
              </div>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}
