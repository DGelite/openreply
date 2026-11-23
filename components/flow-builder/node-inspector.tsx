"use client";

import { FlowNode, FlowNodeType } from "@/lib/flow/types";
import { useEffect, useState, useRef } from "react";

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
  const [newKeyword, setNewKeyword] = useState("");

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

  const updateMultipleConfig = (updates: Record<string, any>) => {
    onUpdateNode({
      ...selectedNode,
      data: {
        ...data,
        config: {
          ...(data as any).config,
          ...updates,
        },
      } as any,
    });
  };

  const config = (data as any).config || {};

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    const current = Array.isArray(config.keywords) ? config.keywords : [];
    if (!current.includes(trimmed)) {
      updateConfig("keywords", [...current, trimmed]);
    }
    setNewKeyword("");
  };

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

        {/* ── 0. TRIGGER (Event & Keywords) ─────────────────────────── */}
        {type === "trigger" && (
          <div className="space-y-4">
            {/* Trigger Type */}
            <div>
              <label className="text-xs font-medium text-muted block mb-1">نوع رویداد شروع‌کننده (Trigger)</label>
              <select
                value={config.triggerType || "COMMENT_KEYWORD"}
                onChange={(e) => updateConfig("triggerType", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              >
                <option value="ALL">🌐 همه رویدادها (کامنت، دایرکت، استوری، ری‌اکشن)</option>
                <option value="COMMENT_KEYWORD">کامنت روی پست / ریلز (Comment Keyword)</option>
                <option value="DIRECT_MESSAGE">ارسال پیام در دایرکت (Direct Message)</option>
                <option value="STORY_REPLY">پاسخ به استوری (Story Reply)</option>
                <option value="STORY_MENTION">منشن شدن پیج در استوری (Story Mention)</option>
                <option value="STORY_REACTION">ری‌اکشن به استوری (Story Reaction)</option>
                <option value="WELCOME">پیام خوش‌آمدگویی (Welcome Message)</option>
              </select>
            </div>

            {/* Post Target (If comment) */}
            {(!config.triggerType || config.triggerType === "COMMENT_KEYWORD") && (
              <div className="p-2.5 rounded-lg border border-border bg-background/50 space-y-2">
                <label className="text-xs font-medium text-foreground block">هدف کامنت</label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="triggerPostScope"
                      checked={config.matchAnyPost !== false}
                      onChange={() => updateConfig("matchAnyPost", true)}
                      className="accent-accent"
                    />
                    <span>همه پست‌ها و ریلزها</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="triggerPostScope"
                      checked={config.matchAnyPost === false}
                      onChange={() => updateConfig("matchAnyPost", false)}
                      className="accent-accent"
                    />
                    <span>پست یا ریلز مشخص</span>
                  </label>
                </div>

                {config.matchAnyPost === false && (
                  <div className="pt-1">
                    <input
                      type="text"
                      placeholder="شناسه رسانه (Media ID) مثلاً 18087850304500002"
                      value={config.postId || ""}
                      onChange={(e) => updateConfig("postId", e.target.value)}
                      className="w-full rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground font-mono text-left"
                      dir="ltr"
                    />
                    <p className="text-[10px] text-muted mt-1">
                      شناسه پست یا ریلز را وارد کنید تا این فلو فقط برای همان محتوا فعال شود.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Keyword matching mode */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted">تنظیم کلمات کلیدی محرک</label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(config.matchAnyWord)}
                    onChange={(e) => updateConfig("matchAnyWord", e.target.checked)}
                    className="accent-accent rounded"
                  />
                  <span>هر کلمه‌ای (Match Any Word)</span>
                </label>
              </div>

              {!config.matchAnyWord && (
                <div className="space-y-2">
                  {/* Add keyword input */}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="کلمه کلیدی جدید (مثلا: قیمت، ۱۲، خرید)..."
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddKeyword();
                        }
                      }}
                      className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted/60"
                    />
                    <button
                      type="button"
                      onClick={handleAddKeyword}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 shrink-0"
                    >
                      افزودن
                    </button>
                  </div>

                  {/* Keywords tags list */}
                  <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-md border border-border bg-background/50">
                    {(config.keywords || []).length === 0 ? (
                      <span className="text-[11px] text-muted">هیچ کلمه کلیدی ثبت نشده است.</span>
                    ) : (
                      (config.keywords || []).map((kw: string, kwIdx: number) => (
                        <span
                          key={kwIdx}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/30 font-medium"
                        >
                          {kw}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (config.keywords || []).filter((_: any, i: number) => i !== kwIdx);
                              updateConfig("keywords", updated);
                            }}
                            className="hover:text-rose-400 font-bold ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Whole word match */}
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={config.wholeWordMatch !== false}
                      onChange={(e) => updateConfig("wholeWordMatch", e.target.checked)}
                      className="accent-accent rounded"
                    />
                    <span>تطابق دقیق کلمه (Whole Word Match)</span>
                  </label>
                </div>
              )}
            </div>

            {/* Public reply for comments */}
            {(!config.triggerType || config.triggerType === "COMMENT_KEYWORD") && (
              <div className="pt-2 border-t border-border space-y-2">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(config.publicReplyEnabled)}
                    onChange={(e) => updateConfig("publicReplyEnabled", e.target.checked)}
                    className="accent-accent rounded"
                  />
                  <span className="font-medium">ارسال پاسخ عمومی زیر کامنت (Public Reply)</span>
                </label>

                {config.publicReplyEnabled && (
                  <div>
                    <textarea
                      rows={2}
                      value={config.publicReplyMessage || (config.publicReplyMessages?.[0] || "")}
                      onChange={(e) => {
                        updateMultipleConfig({
                          publicReplyMessage: e.target.value,
                          publicReplyMessages: [e.target.value],
                        });
                      }}
                      placeholder="مثال: دایرکت‌تون رو چک کنید براتون ارسال شد 🙏"
                      className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground resize-y"
                    />
                    <p className="text-[10px] text-muted mt-0.5">
                      این پیام در پاسخ به همان کامنت زیر پست ارسال می‌شود.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 1. SEND_DM (Text DM) ─────────────────────────────────── */}
        {type === "send_dm" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">متن پیام دایرکت</label>
              <textarea
                rows={4}
                value={config.messageText || config.message || ""}
                onChange={(e) => {
                  updateMultipleConfig({
                    message: e.target.value,
                    messageText: e.target.value,
                  });
                }}
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

        {/* ── 2. SEND_MEDIA (Upload, Voice Record, Preview) ────────── */}
        {type === "send_media" && (
          <MediaInspectorSection config={config} updateConfig={updateConfig} />
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

        {/* ── 11. COLLECT_INPUT (Lead Capture: Phone, Name, Email) ─── */}
        {type === "collect_input" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">نوع داده دریافتی (Input Type)</label>
              <select
                value={config.inputType || "phone"}
                onChange={(e) => updateConfig("inputType", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              >
                <option value="phone">شماره همراه (Phone Number - فرمت ایران ۰۹)</option>
                <option value="name">نام و نام خانوادگی (Full Name)</option>
                <option value="email">آدرس ایمیل (Email Address)</option>
                <option value="text">متن دلخواه (Custom Text)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">متن پیام درخواست در دایرکت</label>
              <textarea
                rows={3}
                value={config.promptMessage || ""}
                onChange={(e) => updateConfig("promptMessage", e.target.value)}
                placeholder={
                  config.inputType === "email"
                    ? "لطفاً آدرس ایمیل خود را ارسال فرمایید:"
                    : config.inputType === "name"
                    ? "لطفاً نام و نام خانوادگی خود را ارسال فرمایید:"
                    : "لطفاً شماره تماس همراه خود را ارسال کنید:"
                }
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground resize-y"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">پیام تایید پس از دریافت صحیح (Success Message)</label>
              <input
                type="text"
                value={config.successMessage || ""}
                onChange={(e) => updateConfig("successMessage", e.target.value)}
                placeholder="اطلاعات شما با موفقیت ثبت شد! به زودی با شما تماس می‌گیریم. 🙏"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">پیام خطا در صورت فرمت اشتباه</label>
              <input
                type="text"
                value={config.validationErrorMessage || ""}
                onChange={(e) => updateConfig("validationErrorMessage", e.target.value)}
                placeholder="فرمت وارد شده معتبر نیست. لطفاً مجدداً ارسال کنید."
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              />
            </div>

            {(!config.inputType || config.inputType === "phone") && (
              <div className="pt-2 border-t border-border space-y-1.5">
                <label className="flex items-center gap-2 text-xs cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(config.requireOtp)}
                    onChange={(e) => updateConfig("requireOtp", e.target.checked)}
                    className="accent-accent rounded w-3.5 h-3.5"
                  />
                  <span className="font-medium">ارسال کد تأیید پیامکی (SMS OTP)</span>
                </label>
                <p className="text-[10px] text-muted leading-relaxed">
                  با فعال‌سازی این گزینه، پس از دریافت شماره، کد ۵ رقمی از طریق درگاه sms.ir پیامک شده و برای اعتبارسنجی در دایرکت درخواست می‌شود.
                </p>
              </div>
            )}

            {/* Confirmation Step (Optional Confirmation in DM) */}
            <div className="pt-2 border-t border-border space-y-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer text-foreground">
                <input
                  type="checkbox"
                  checked={Boolean(config.confirmBeforeSave)}
                  onChange={(e) => updateConfig("confirmBeforeSave", e.target.checked)}
                  className="accent-accent rounded w-3.5 h-3.5"
                />
                <span className="font-medium">دریافت تأییدیه قبل از ثبت نهایی (Confirmation Step)</span>
              </label>
              <p className="text-[10px] text-muted leading-relaxed">
                در صورت فعال بودن، پس از دریافت مقدار از کاربر، یک پیام تایید همراه با دکمه‌های شیشه‌ای «✅ تایید» و «✏️ ویرایش» ارسال می‌شود تا کاربر از صحت اطلاعات ارسالی خود مطمئن شود.
              </p>

              {config.confirmBeforeSave && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-medium text-muted block">
                    متن مودبانه پیام تأییدیه (متغیر <code className="text-accent font-mono font-bold">{"{value}"}</code> با مقدار ارسالی کاربر جایگزین می‌شود):
                  </label>
                  <textarea
                    rows={2}
                    value={
                      config.confirmMessage !== undefined
                        ? config.confirmMessage
                        : config.inputType === "name"
                        ? "نام شما «{value}» ثبت شد. آیا مورد تایید است؟"
                        : "شماره همراه شما {value} ثبت شد. آیا مورد تایید شماست؟"
                    }
                    onChange={(e) => updateConfig("confirmMessage", e.target.value)}
                    placeholder="شماره همراه شما {value} ثبت شد. آیا مورد تایید شماست؟"
                    className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground resize-y leading-relaxed"
                  />
                </div>
              )}
            </div>

            <div className="p-2.5 rounded-lg border border-accent/20 bg-accent/5 text-[11px] text-accent leading-relaxed">
              ✨ <strong>سینک خودکار با CRM:</strong> با دریافت شماره و نام لید در این مرحله، اطلاعات لید در سیستم ثبت شده و به سیستم مدیریت CRM (<span className="font-mono">admin.php</span>) ارسال می‌گردد.
            </div>
          </div>
        )}

        {/* ── 12. WEBHOOK_ACTION ───────────────────────────────────── */}
        {type === "webhook_action" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">آدرس وب‌هوک (Webhook URL)</label>
              <input
                type="url"
                placeholder="https://your-crm.com/api/webhook"
                value={config.webhookUrl || ""}
                onChange={(e) => updateConfig("webhookUrl", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">متد ارسال (HTTP Method)</label>
              <select
                value={config.httpMethod || "POST"}
                onChange={(e) => updateConfig("httpMethod", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono"
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">پیلود سفارشی (JSON - اختیاری)</label>
              <textarea
                rows={3}
                value={config.customPayloadJson || ""}
                onChange={(e) => updateConfig("customPayloadJson", e.target.value)}
                placeholder='{"source": "instagram_flow"}'
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground font-mono text-left resize-y"
                dir="ltr"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Enhanced Media Inspector Section:
 * Direct File Upload, In-Browser Voice Recording, and Live Media Preview.
 */
function MediaInspectorSection({
  config,
  updateConfig,
}: {
  config: any;
  updateConfig: (key: string, value: any) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  const mediaType = config.mediaType || "image";

  // Handle local file selection and upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "خطا در آپلود فایل");
      }

      updateConfig("mediaUrl", data.fullUrl || data.url);

      if (file.type.startsWith("audio/")) {
        updateConfig("mediaType", "audio");
      } else if (file.type.startsWith("video/")) {
        updateConfig("mediaType", "video");
      } else if (file.type.startsWith("image/")) {
        updateConfig("mediaType", "image");
      }
    } catch (err: any) {
      setUploadError(err.message || "خطا در آپلود فایل");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Start voice recording from browser microphone
  const startRecording = async () => {
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedAudioBlob(audioBlob);
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone error:", err);
      setUploadError("دسترسی به میکروفون امکان‌پذیر نیست. لطفاً اجازه دسترسی را در مرورگر فعال کنید.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // Upload the recorded voice note
  const uploadVoiceRecording = async () => {
    if (!recordedAudioBlob) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const ext = recordedAudioBlob.type.includes("webm")
        ? "webm"
        : recordedAudioBlob.type.includes("ogg")
        ? "ogg"
        : "m4a";
      const file = new File([recordedAudioBlob], `voice-note-${Date.now()}.${ext}`, {
        type: recordedAudioBlob.type,
      });

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "خطا در آپلود ویس");
      }

      updateConfig("mediaUrl", data.fullUrl || data.url);
      updateConfig("mediaType", "audio");
      setRecordedAudioBlob(null);
      setRecordedAudioUrl(null);
    } catch (err: any) {
      setUploadError(err.message || "خطا در ذخیره ویس");
    } finally {
      setIsUploading(false);
    }
  };

  const cancelRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted block mb-1">نوع رسانه (Media Type)</label>
        <select
          value={mediaType}
          onChange={(e) => updateConfig("mediaType", e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
        >
          <option value="audio">فایل صوتی / وویس (Voice / Audio - MP3 / M4A / OGG)</option>
          <option value="image">عکس (Image - JPG / PNG / WEBP)</option>
          <option value="video">ویدیو (Video - MP4 / MOV)</option>
        </select>
      </div>

      {/* Hidden native file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={
          mediaType === "audio"
            ? "audio/*"
            : mediaType === "video"
            ? "video/*"
            : "image/*"
        }
        className="hidden"
      />

      {/* Upload and Recording Control Panel */}
      <div className="p-3 rounded-lg border border-border bg-background/50 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">بارگذاری مستقیم رسانه:</span>
          {isUploading && (
            <span className="text-[11px] text-accent animate-pulse font-medium">در حال آپلود...</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* File Picker Button */}
          <button
            type="button"
            disabled={isUploading || isRecording}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-accent/10 hover:bg-accent/20 text-accent text-xs font-medium transition-colors border border-accent/20 disabled:opacity-50"
          >
            <span>📁</span>
            <span>انتخاب فایل از سیستم</span>
          </button>

          {/* Direct Voice Recorder (Visible for Audio) */}
          {mediaType === "audio" && (
            <>
              {!isRecording && !recordedAudioBlob && (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={startRecording}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition-colors border border-rose-500/20"
                >
                  <span>🎙️</span>
                  <span>ضبط ویس با میکروفون</span>
                </button>
              )}

              {isRecording && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-rose-500 text-white text-xs font-bold animate-pulse"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span>توقف ضبط ({formatTimer(recordingSeconds)})</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Live Audio Recorded Preview (Before Upload) */}
        {recordedAudioBlob && recordedAudioUrl && !isRecording && (
          <div className="p-2.5 rounded-md border border-rose-500/30 bg-rose-500/5 space-y-2">
            <div className="flex items-center justify-between text-xs text-rose-300">
              <span className="font-medium">🎧 پیش‌نمایش ویس ضبط‌شده:</span>
              <span className="font-mono">{formatTimer(recordingSeconds)}</span>
            </div>
            <audio src={recordedAudioUrl} controls className="w-full h-8" />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isUploading}
                onClick={uploadVoiceRecording}
                className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors text-center disabled:opacity-50"
              >
                {isUploading ? "در حال ارسال..." : "✅ ذخیره و قرار دادن در پیام"}
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={cancelRecording}
                className="px-2.5 py-1.5 rounded border border-border hover:bg-background text-muted text-xs transition-colors"
              >
                🔄 ضبط مجدد
              </button>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
            ⚠️ {uploadError}
          </div>
        )}
      </div>

      {/* Active Media Preview (If mediaUrl is set) */}
      {config.mediaUrl && (
        <div className="p-2.5 rounded-lg border border-accent/30 bg-accent/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-accent">رسانه انتخاب‌شده فعلی:</span>
            <button
              type="button"
              onClick={() => updateConfig("mediaUrl", "")}
              className="text-[10px] text-rose-400 hover:underline"
            >
              حذف رسانه
            </button>
          </div>

          {mediaType === "image" && (
            <img
              src={config.mediaUrl}
              alt="Media Preview"
              className="max-h-36 w-full object-cover rounded-md border border-border"
            />
          )}

          {mediaType === "video" && (
            <video
              src={config.mediaUrl}
              controls
              className="max-h-40 w-full rounded-md border border-border bg-black/40"
            />
          )}

          {mediaType === "audio" && (
            <audio src={config.mediaUrl} controls className="w-full h-9" />
          )}
        </div>
      )}

      {/* Public HTTPS URL (Manual override & inspect) */}
      <div>
        <label className="text-xs font-medium text-muted block mb-1">
          آدرس مستقیم فایل (Public HTTPS URL)
        </label>
        <input
          type="url"
          placeholder="https://insta.digitalelite.ir/uploads/media/file.mp3"
          value={config.mediaUrl || ""}
          onChange={(e) => updateConfig("mediaUrl", e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono text-left"
          dir="ltr"
        />
        <p className="text-[10px] text-muted mt-1 leading-relaxed">
          فایل‌های آپلودشده یا ضبط‌شده به صورت خودکار با لینک امن HTTPS در این فیلد قرار می‌گیرند.
        </p>
      </div>

      {/* Caption for image/video */}
      {mediaType !== "audio" && (
        <div>
          <label className="text-xs font-medium text-muted block mb-1">کپشن متن همراه مدیا (اختیاری)</label>
          <input
            type="text"
            placeholder="توضیحات کوتاه تصویر یا ویدیو..."
            value={config.caption || ""}
            onChange={(e) => updateConfig("caption", e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
          />
        </div>
      )}
    </div>
  );
}
