"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import { LanguageProvider } from "@/context/language-context";

interface DashboardShellProps {
  children: React.ReactNode;
  workspaceName: string;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function DashboardShell({
  children,
  workspaceName,
  instagramUsername,
  instagramAccountCount,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Check if current page is a full-bleed workspace tool like Flow Builder
  const isFullBleedPage =
    Boolean(pathname?.startsWith("/flows/new")) ||
    Boolean(pathname?.match(/\/flows\/[^/]+\/edit/));

  return (
    <LanguageProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          workspaceName={workspaceName}
        />

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <TopBar
            onMenuClick={() => setSidebarOpen(true)}
            instagramUsername={instagramUsername}
            instagramAccountCount={instagramAccountCount}
          />

          <main className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
            {isFullBleedPage ? (
              <div className="flex-1 overflow-hidden flex flex-col w-full h-full">
                {children}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 lg:px-8 py-6 max-w-7xl mx-auto">
                  {children}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </LanguageProvider>
  );
}

