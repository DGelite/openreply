"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "en" | "fa";

const translations = {
  en: {
    dashboard: "Dashboard",
    overview: "Overview",
    inbox: "Inbox",
    campaigns: "Campaigns",
    flows: "Visual Flows",
    logs: "DM Logs",
    aiAgent: "AI Agent",
    leadForms: "Lead Forms",
    features: "Feature Control",
    users: "User Management",
    dlq: "Dead Letter Queue (DLQ)",
    funnel: "Conversion Funnel",
    settings: "Settings",
    diagnostics: "Diagnostics",
    connectedAccounts: "Connected Accounts",
    activeCampaigns: "Active Campaigns",
    dmsSent: "DMs Sent",
    skipped: "Skipped",
    failed: "Failed",
    clicks: "Clicks",
    ctr: "CTR",
    save: "Save Changes",
    cancel: "Cancel",
    status: "Status",
    actions: "Actions",
  },
  fa: {
    dashboard: "داشبورد",
    overview: "نمای کلی",
    inbox: "صندوق پیام‌ها",
    campaigns: "کمپین‌ها",
    flows: "فلوهای دیداری",
    logs: "لاگ‌های پیام (DM)",
    aiAgent: "عامل هوشمند (AI Agent)",
    leadForms: "فرم‌های لید",
    features: "تنظیمات ویژگی‌ها",
    users: "مدیریت کاربران",
    dlq: "صف خطاهای سیستم (DLQ)",
    funnel: "قیف تبدیل (Funnel)",
    settings: "تنظیمات",
    diagnostics: "عیب‌یابی",
    connectedAccounts: "اکانت‌های متصل",
    activeCampaigns: "کمپین‌های فعال",
    dmsSent: "ارسال‌شده‌ها",
    skipped: "رد شده‌ها",
    failed: "ناموفق‌ها",
    clicks: "کلیک‌ها",
    ctr: "نرخ کلیک",
    save: "ذخیره تغییرات",
    cancel: "انصراف",
    status: "وضعیت",
    actions: "عملیات",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations["en"]) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType>({
  language: "fa",
  setLanguage: () => {},
  t: (key) => translations.fa[key] || key,
  dir: "rtl",
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fa");

  useEffect(() => {
    const saved = localStorage.getItem("openreply_lang") as Language;
    if (saved && (saved === "en" || saved === "fa")) {
      setLanguageState(saved);
    }
  }, []);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    localStorage.setItem("openreply_lang", lang);
  }

  const dir = language === "fa" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  function t(key: keyof typeof translations["en"]): string {
    return translations[language][key] || translations["en"][key] || String(key);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      <div dir={dir} className={language === "fa" ? "font-sans dir-rtl" : "font-sans dir-ltr"}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
