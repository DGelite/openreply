"use client";

/**
 * Sidebar Navigation
 *
 * Text-only nav with active state, bilingual language support, and workspace section.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/language-context";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

export default function Sidebar({
  isOpen,
  onClose,
  workspaceName,
}: SidebarProps) {
  const pathname = usePathname();
  const { language, setLanguage, t, dir } = useLanguage();

  const navItems = [
    { key: "dashboard", href: "/dashboard" },
    { key: "overview", href: "/overview" },
    { key: "inbox", href: "/inbox" },
    { key: "campaigns", href: "/campaigns" },
    { key: "flows", href: "/flows" },
    { key: "logs", href: "/logs" },
    { key: "aiAgent", href: "/admin/ai-agent" },
    { key: "leadForms", href: "/admin/lead-forms" },
    { key: "funnel", href: "/dashboard/funnel" },
    { key: "features", href: "/admin/settings/features" },
    { key: "users", href: "/admin/users" },
    { key: "dlq", href: "/admin/dlq" },
    { key: "settings", href: "/settings" },
    { key: "diagnostics", href: "/diagnostics" },
  ] as const;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 ${dir === "rtl" ? "right-0 border-l" : "left-0 border-r"} z-50 h-full w-64 bg-surface border-border flex flex-col
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : dir === "rtl" ? "translate-x-full" : "-translate-x-full"}
        `}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <Link href="/dashboard" className="text-base font-semibold text-foreground">
            OpenReply
          </Link>
          <button
            onClick={() => setLanguage(language === "fa" ? "en" : "fa")}
            className="text-xs px-2.5 py-1 rounded border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors font-medium"
          >
            {language === "fa" ? "English" : "فارسی"}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`
                  block px-3 py-2 rounded text-sm transition-colors
                  ${
                    isActive
                      ? "bg-surface-hover text-foreground font-medium"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }
                `}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <p className="text-sm text-foreground truncate">{workspaceName}</p>
          <p className="text-xs text-muted">Enterprise Edition</p>
        </div>
      </aside>
    </>
  );
}
