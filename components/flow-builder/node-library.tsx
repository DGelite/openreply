"use client";

import { FlowNodeType } from "@/lib/flow/types";

interface NodeLibraryItem {
  type: FlowNodeType;
  title: string;
  description: string;
  icon: string;
  badgeColor: string;
}

const LIBRARY_ITEMS: NodeLibraryItem[] = [
  {
    type: "trigger",
    title: "محرک (Trigger)",
    description: "شروع فلو با کامنت، استوری، ری‌اکشن یا دایرکت",
    icon: "⚡",
    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  {
    type: "send_dm",
    title: "ارسال پیام متنی (Text DM)",
    description: "ارسال متن به همراه دکمه‌های شیشه‌ای و لینک",
    icon: "💬",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  {
    type: "send_media",
    title: "ارسال مدیا (Image / Video / Audio)",
    description: "ارسال عکس، ویدیو یا وویس مستقیم در دایرکت",
    icon: "🎬",
    badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  },
  {
    type: "send_carousel",
    title: "اسلایدر محصولات (Carousel)",
    description: "کاروسل کارت‌های چندگانه با عکس، عنوان و دکمه خرید",
    icon: "🎴",
    badgeColor: "bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20",
  },
  {
    type: "quick_reply",
    title: "پاسخ‌های سریع (Quick Replies)",
    description: "دکمه‌های چیپسی تعاملی برای انتخاب سریع مشتری",
    icon: "🔘",
    badgeColor: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  },
  {
    type: "condition",
    title: "شرط و تصمیم (Condition)",
    description: "انشعاب هوشمند بر اساس تگ، متن، شماره یا ایمیل",
    icon: "🔀",
    badgeColor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
  {
    type: "add_tag",
    title: "افزودن برچسب (Add Tag)",
    description: "برچسب‌گذاری روی لید برای سگمنت‌بندی دقیق CRM",
    icon: "🏷️",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
  {
    type: "remove_tag",
    title: "حذف برچسب (Remove Tag)",
    description: "برداشتن تگ از روی لید در تغییر وضعیت مشتری",
    icon: "✂️",
    badgeColor: "bg-amber-600/10 text-amber-600 border-amber-600/20",
  },
  {
    type: "enroll_drip",
    title: "کمپین قطره‌ای (Drip Sequence)",
    description: "ورود لید به نردبان پیام‌های خودکار زمان‌بندی‌شده",
    icon: "💧",
    badgeColor: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  },
  {
    type: "ai_reply",
    title: "پاسخ هوش مصنوعی (AI Agent)",
    description: "تولید پاسخ هوشمند و زنده با هوش مصنوعی و پرامپت اختصاصی",
    icon: "🤖",
    badgeColor: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  },
  {
    type: "handover_to_human",
    title: "انتقال به اپراتور (Live Chat Handover)",
    description: "توقف ربات و ارجاع مکالمه به پشتیبان انسانی",
    icon: "👤",
    badgeColor: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
  {
    type: "collect_input",
    title: "دریافت اطلاعات (Collect Input)",
    description: "دریافت شماره موبایل، ایمیل یا داده متنی از مشتری",
    icon: "📝",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
  {
    type: "webhook_action",
    title: "اکشن وب‌هوک (Webhook Action)",
    description: "ارسال آنی لید به Zapier / Make / CRM خارجی",
    icon: "🚀",
    badgeColor: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  },
  {
    type: "smart_delay",
    title: "تاخیر هوشمند (Smart Delay)",
    description: "صبر و ایجاد تاخیر طبیعی قبل از ارسال پیام بعدی",
    icon: "⏱️",
    badgeColor: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  },
];

interface NodeLibraryProps {
  onAddNode: (type: FlowNodeType) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function NodeLibrary({ onAddNode, isOpen = true, onToggle }: NodeLibraryProps) {
  if (!isOpen) {
    return (
      <div className="w-12 border-r border-border bg-panel flex flex-col items-center py-4 gap-3 shrink-0 z-10">
        <button
          type="button"
          onClick={onToggle}
          title="باز کردن کتابخانه نودها"
          className="p-2 rounded-lg bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 text-xs font-bold transition-all"
        >
          ➕
        </button>
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          {LIBRARY_ITEMS.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => onAddNode(item.type)}
              title={`افزودن ${item.title}`}
              className="p-2 rounded-md hover:bg-accent/10 text-sm transition-transform hover:scale-110"
            >
              {item.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 sm:w-72 border-r border-border bg-panel p-4 flex flex-col gap-4 overflow-y-auto shrink-0 z-10 transition-all">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">کتابخانه نودها</h3>
          <p className="text-xs text-muted">روی نود کلیک کنید تا به بوم اضافه شود</p>
        </div>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            title="بستن کتابخانه"
            className="p-1 text-xs text-muted hover:text-foreground rounded hover:bg-background transition-colors"
          >
            ◀
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {LIBRARY_ITEMS.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => onAddNode(item.type)}
            className="flex w-full items-start gap-3 rounded-lg border border-border bg-background/50 p-3 text-right hover:border-accent hover:bg-accent/5 transition-all group"
          >
            <span className="text-xl shrink-0 p-1 rounded-md bg-panel border border-border group-hover:scale-110 transition-transform">
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-medium text-foreground truncate">
                  {item.title}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${item.badgeColor}`}>
                  {item.type}
                </span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed line-clamp-2">
                {item.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
