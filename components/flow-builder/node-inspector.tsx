"use client";

import { FlowNode, FlowNodeType } from "@/lib/flow/types";
import { useEffect, useState } from "react";

interface NodeInspectorProps {
  selectedNode: FlowNode | null;
  allNodes: FlowNode[];
  allEdges?: any[];
  onUpdateNode: (updatedNode: FlowNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onClose: () => void;
}

const NODE_TYPE_LABELS: Record<FlowNodeType, string> = {
  trigger: "محرک (Trigger)",
  send_dm: "ارسال پیام متنی",
  send_media: "ارسال مدیا (عکس/ویدیو/صدا)",
  send_carousel: "اسلایدر محصولات (Carousel)",
  quick_reply: "پاسخ سریع (Quick Replies)",
  condition: "شرط و تصمیم",
  add_tag: "افزودن برچسب (CRM Tag)",
  remove_tag: "حذف برچسب (Remove Tag)",
  enroll_drip: "کمپین قطره‌ای (Drip Sequence)",
  ai_reply: "پاسخ هوش مصنوعی (AI Agent)",
  handover_to_human: "انتقال به اپراتور انسانی",
  collect_input: "دریافت اطلاعات",
  webhook_action: "اکشن وب‌هوک",
  smart_delay: "تاخیر هوشمند",
};

export default function NodeInspector({
  selectedNode,
  allNodes,
  allEdges = [],
  onUpdateNode,
  onDeleteNode,
  onDeleteEdge,
  onClose,
}: NodeInspectorProps) {
  const [dripCampaigns, setDripCampaigns] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/admin/drip-campaigns")
      .then((res) => res.json())
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.data)) {
          setDripCampaigns(res.data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  if (!selectedNode) return null;

  const { id, type, title, data } = selectedNode;

  const updateConfig = (key: string, value: any) => {
    onUpdateNode({
      ...selectedNode,
      data: {
        ...data,
        config: {
          ...(data as any).config,
          [key]: value,
        },
      } as any,
    });
  };

  const config = (data as any).config || {};

  return (
    <div
      className="w-80 sm:w-96 h-full border-l border-border bg-panel flex flex-col shrink-0 nodrag nopan select-text z-10 transition-all shadow-2xl"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0 bg-panel z-10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDeleteNode(id)}
            title="حذف نود"
            className="text-xs text-rose-500 hover:bg-rose-500/10 p-1.5 rounded transition-colors"
          >
            🗑️
          </button>
          <div>
            <span className="text-[10px] font-mono text-muted uppercase">تنظیمات نود</span>
            <h3 className="text-sm font-semibold text-foreground truncate max-w-[180px]">
              {NODE_TYPE_LABELS[type] || title}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted hover:text-foreground p-1 rounded"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 text-right" dir="rtl">
        {/* Title Input */}
        <div>
          <label className="text-xs font-medium text-muted block mb-1">عنوان نود</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onUpdateNode({ ...selectedNode, title: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
          />
        </div>

        {/* ── 1. SEND_DM (Text DM) ─────────────────────────────────── */}
        {type === "send_dm" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">متن پیام دایرکت</label>
              <textarea
                rows={4}
                value={config.messageText || ""}
                onChange={(e) => updateConfig("messageText", e.target.value)}
                placeholder="سلام! از پیام شما متشکریم..."
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:border-accent resize-y"
              />
            </div>

            {/* Buttons list */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted">دکمه‌های تعاملی (تا ۳ دکمه)</label>
                {(config.buttons?.length || 0) < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      const current = config.buttons || [];
                      updateConfig("buttons", [
                        ...current,
                        { type: "web_url", title: "مشاهده لینک", url: "https://" },
                      ]);
                    }}
                    className="text-[11px] text-accent hover:underline font-medium"
                  >
                    + افزودن دکمه
                  </button>
                )}
              </div>

              {(config.buttons || []).map((btn: any, idx: number) => (
                <div key={idx} className="p-2.5 rounded border border-border bg-background/50 space-y-2 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted">دکمه #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (config.buttons || []).filter((_: any, i: number) => i !== idx);
                        updateConfig("buttons", updated);
                      }}
                      className="text-[10px] text-rose-500 hover:underline"
                    >
                      حذف
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="عنوان دکمه (حداکثر ۲۰ کاراکتر)"
                    value={btn.title || ""}
                    onChange={(e) => {
                      const updated = [...(config.buttons || [])];
                      updated[idx] = { ...updated[idx], title: e.target.value };
                      updateConfig("buttons", updated);
                    }}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                  />
                  <input
                    type="text"
                    placeholder="آدرس لینک (URL)"
                    value={btn.url || ""}
                    onChange={(e) => {
                      const updated = [...(config.buttons || [])];
                      updated[idx] = { ...updated[idx], url: e.target.value };
                      updateConfig("buttons", updated);
                    }}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground font-mono text-left"
                    dir="ltr"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 2. SEND_MEDIA ────────────────────────────────────────── */}
        {type === "send_media" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">نوع رسانه (Media Type)</label>
              <select
                value={config.mediaType || "image"}
                onChange={(e) => updateConfig("mediaType", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              >
                <option value="image">عکس (Image - JPG / PNG)</option>
                <option value="video">ویدیو (Video - MP4)</option>
                <option value="audio">فایل صوتی / وویس (Audio - MP3 / AAC)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">آدرس مستقیم فایل (Public HTTPS URL)</label>
              <input
                type="url"
                placeholder="https://example.com/media/file.jpg"
                value={config.mediaUrl || ""}
                onChange={(e) => updateConfig("mediaUrl", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono text-left"
                dir="ltr"
              />
              <p className="text-[10px] text-muted mt-1 leading-relaxed">
                طبق قوانین متا، لینک رسانه باید عمومی و با پروتکل HTTPS باشد.
              </p>
            </div>
          </div>
        )}

        {/* ── 3. SEND_CAROUSEL ─────────────────────────────────────── */}
        {type === "send_carousel" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted">کارت‌های اسلایدر (تا ۱۰ کارت)</label>
              {(config.elements?.length || 0) < 10 && (
                <button
                  type="button"
                  onClick={() => {
                    const current = config.elements || [];
                    updateConfig("elements", [
                      ...current,
                      {
                        title: `محصول ${current.length + 1}`,
                        subtitle: "توضیحات کوتاه محصول",
                        image_url: "",
                        buttons: [{ type: "web_url", title: "خرید آنلاین", url: "https://" }],
                      },
                    ]);
                  }}
                  className="text-[11px] text-accent hover:underline font-medium"
                >
                  + افزودن کارت جدید
                </button>
              )}
            </div>

            {(config.elements || []).map((card: any, cardIdx: number) => (
              <div key={cardIdx} className="p-3 rounded-lg border border-border bg-background/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">کارت شماره {cardIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (config.elements || []).filter((_: any, i: number) => i !== cardIdx);
                      updateConfig("elements", updated);
                    }}
                    className="text-[10px] text-rose-500 hover:underline"
                  >
                    حذف کارت
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="عنوان کارت (حداکثر ۸۰ کاراکتر)"
                  value={card.title || ""}
                  onChange={(e) => {
                    const updated = [...(config.elements || [])];
                    updated[cardIdx] = { ...updated[cardIdx], title: e.target.value };
                    updateConfig("elements", updated);
                  }}
                  className="w-full rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground"
                />
                <input
                  type="text"
                  placeholder="زیرعنوان کارت (اختیاری)"
                  value={card.subtitle || ""}
                  onChange={(e) => {
                    const updated = [...(config.elements || [])];
                    updated[cardIdx] = { ...updated[cardIdx], subtitle: e.target.value };
                    updateConfig("elements", updated);
                  }}
                  className="w-full rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground"
                />
                <input
                  type="url"
                  placeholder="آدرس عکس کارت (HTTPS Image URL)"
                  value={card.image_url || ""}
                  onChange={(e) => {
                    const updated = [...(config.elements || [])];
                    updated[cardIdx] = { ...updated[cardIdx], image_url: e.target.value };
                    updateConfig("elements", updated);
                  }}
                  className="w-full rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground font-mono text-left"
                  dir="ltr"
                />
              </div>
            ))}
          </div>
        )}

        {/* ── 4. QUICK_REPLY ───────────────────────────────────────── */}
        {type === "quick_reply" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">متن راهنمای پاسخ سریع</label>
              <input
                type="text"
                placeholder="یک گزینه را انتخاب کنید:"
                value={config.messageText || ""}
                onChange={(e) => updateConfig("messageText", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted">گزینه‌های شیشه‌ای (تا ۱۳ گزینه)</label>
              {(config.quickReplies?.length || 0) < 13 && (
                <button
                  type="button"
                  onClick={() => {
                    const current = config.quickReplies || [];
                    updateConfig("quickReplies", [
                      ...current,
                      { title: `گزینه ${current.length + 1}`, payload: `choice_${current.length + 1}` },
                    ]);
                  }}
                  className="text-[11px] text-accent hover:underline font-medium"
                >
                  + افزودن گزینه
                </button>
              )}
            </div>

            {(config.quickReplies || []).map((qr: any, qrIdx: number) => (
              <div key={qrIdx} className="flex items-center gap-2 p-2 rounded border border-border bg-background/50">
                <input
                  type="text"
                  placeholder="عنوان دکمه (مثلا: لیست قیمت)"
                  value={qr.title || ""}
                  onChange={(e) => {
                    const updated = [...(config.quickReplies || [])];
                    updated[qrIdx] = { ...updated[qrIdx], title: e.target.value };
                    updateConfig("quickReplies", updated);
                  }}
                  className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = (config.quickReplies || []).filter((_: any, i: number) => i !== qrIdx);
                    updateConfig("quickReplies", updated);
                  }}
                  className="text-xs text-rose-500 hover:bg-rose-500/10 p-1 rounded"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── 5. ADD_TAG & REMOVE_TAG ──────────────────────────────── */}
        {(type === "add_tag" || type === "remove_tag") && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">
                نام برچسب ({type === "add_tag" ? "افزودن" : "حذف"})
              </label>
              <input
                type="text"
                placeholder="مثال: vip_customer یا lead_interested"
                value={config.tagName || ""}
                onChange={(e) => updateConfig("tagName", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono text-left"
                dir="ltr"
              />
              <p className="text-[10px] text-muted mt-1 leading-relaxed">
                این برچسب مستقیماً روی پروفایل لید در CRM ذخیره می‌شود و می‌تواند کمپین‌های قطره‌ای را آغاز کند.
              </p>
            </div>
          </div>
        )}

        {/* ── 6. ENROLL_DRIP ───────────────────────────────────────── */}
        {type === "enroll_drip" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">انتخاب کمپین قطره‌ای</label>
              <select
                value={config.campaignId || ""}
                onChange={(e) => updateConfig("campaignId", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              >
                <option value="">-- انتخاب کمپین --</option>
                {dripCampaigns.map((camp: any) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name} ({camp.steps?.length || 0} مرحله)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── 7. AI_REPLY ──────────────────────────────────────────── */}
        {type === "ai_reply" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">دستورالعمل هوش مصنوعی (Custom Prompt)</label>
              <textarea
                rows={4}
                value={config.prompt || ""}
                onChange={(e) => updateConfig("prompt", e.target.value)}
                placeholder="به عنوان مشاور فروش، بر اساس پیام کاربر کوتاه و مشتاقانه پاسخ بده..."
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground resize-y"
              />
            </div>
          </div>
        )}

        {/* ── 8. HANDOVER_TO_HUMAN ─────────────────────────────────── */}
        {type === "handover_to_human" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">دلیل انتقال به پشتیبان</label>
              <input
                type="text"
                placeholder="درخواست مکالمه انسانی توسط مشتری"
                value={config.reason || ""}
                onChange={(e) => updateConfig("reason", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              />
            </div>
          </div>
        )}

        {/* ── 9. CONDITION ─────────────────────────────────────────── */}
        {type === "condition" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">نوع شرط</label>
              <select
                value={config.ruleType || "HAS_TAG"}
                onChange={(e) => updateConfig("ruleType", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              >
                <option value="HAS_TAG">بررسی وجود برچسب (Has Tag)</option>
                <option value="TEXT_CONTAINS">متن پیام حاوی عبارت باشد</option>
                <option value="EMAIL_PROVIDED">ایمیل ثبت شده باشد</option>
                <option value="PHONE_PROVIDED">شماره موبایل ثبت شده باشد</option>
              </select>
            </div>

            {config.ruleType === "HAS_TAG" && (
              <div>
                <label className="text-xs font-medium text-muted block mb-1">نام برچسب مورد نظر</label>
                <input
                  type="text"
                  placeholder="مثلا: vip"
                  value={config.tagName || ""}
                  onChange={(e) => updateConfig("tagName", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono text-left"
                  dir="ltr"
                />
              </div>
            )}

            {config.ruleType === "TEXT_CONTAINS" && (
              <div>
                <label className="text-xs font-medium text-muted block mb-1">کلمه یا عبارت کلیدی</label>
                <input
                  type="text"
                  placeholder="مثلا: قیمت"
                  value={config.matchText || ""}
                  onChange={(e) => updateConfig("matchText", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                />
              </div>
            )}
          </div>
        )}

        {/* ── 10. SMART_DELAY ──────────────────────────────────────── */}
        {type === "smart_delay" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted block mb-1">مقدار تاخیر</label>
                <input
                  type="number"
                  min={1}
                  value={config.delayAmount || 5}
                  onChange={(e) => updateConfig("delayAmount", Number(e.target.value))}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground text-center"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted block mb-1">واحد زمان</label>
                <select
                  value={config.delayUnit || "seconds"}
                  onChange={(e) => updateConfig("delayUnit", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                >
                  <option value="seconds">ثانیه</option>
                  <option value="minutes">دقیقه</option>
                  <option value="hours">ساعت</option>
                  <option value="days">روز</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
