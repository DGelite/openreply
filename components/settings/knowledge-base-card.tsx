"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";

interface KnowledgeDoc {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl?: string;
  contentPreview: string;
  chunkCount: number;
  createdAt: string;
}

export function KnowledgeBaseCard() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newSourceType, setNewSourceType] = useState("DOC");
  const [newContent, setNewContent] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchDocs = async () => {
    try {
      const res = await fetch("/api/settings/knowledge");
      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        setDocuments(payload.data);
      }
    } catch (err) {
      console.error("Failed to fetch knowledge docs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setAdding(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          sourceType: newSourceType,
          content: newContent,
        }),
      });

      const payload = await res.json();
      if (payload.success) {
        setMessage({
          type: "success",
          text: isFa ? "✅ سند جدید با موفقیت ذخیره و ایندکس شد." : "Knowledge document indexed successfully.",
        });
        setNewTitle("");
        setNewContent("");
        setShowAddForm(false);
        await fetchDocs();
      } else {
        setMessage({
          type: "error",
          text: payload.error || (isFa ? "خطا در افزودن سند" : "Failed to add document"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: isFa ? "خطای شبکه هنگام ارتباط با سرور" : "Network error adding document",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm(isFa ? "آیا از حذف این سند از پایگاه دانش اطمینان دارید؟" : "Delete this document from knowledge base?")) {
      return;
    }

    setDeletingId(documentId);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/knowledge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      const payload = await res.json();
      if (payload.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
        setMessage({
          type: "success",
          text: isFa ? "✅ سند با موفقیت حذف شد." : "Document deleted successfully.",
        });
      } else {
        setMessage({
          type: "error",
          text: payload.error || (isFa ? "خطا در حذف سند" : "Failed to delete document"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: isFa ? "خطای شبکه هنگام حذف سند" : "Network error deleting document",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="panel rounded p-6 animate-pulse h-48 bg-surface/50" />;
  }

  return (
    <section className="panel rounded p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {isFa ? "پایگاه دانش اختصاصی کسب‌وکار (RAG Knowledge Base)" : "Business Knowledge Base (RAG)"}
          </h2>
          <p className="text-xs text-muted mt-1">
            {isFa
              ? "اسناد، قوانین، قیمت‌ها و پاسخ‌های معتبر بیزینس که دستیار هوش مصنوعی بدون توهم از روی آن‌ها پاسخ می‌دهد"
              : "Business facts, pricing, and FAQ documents used by AI to answer questions without hallucination."}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded bg-accent/10 text-accent px-3 py-1.5 text-xs font-semibold hover:bg-accent/20 transition-colors"
        >
          {showAddForm ? (isFa ? "بستن فرم" : "Cancel") : (isFa ? "+ افزودن سند جدید" : "+ Add Document")}
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded mb-4 text-xs font-medium ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : "bg-red-500/10 text-red-600 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAdd} className="mb-6 p-4 rounded border border-border bg-surface/50 space-y-3">
          <h3 className="text-xs font-semibold text-foreground">
            {isFa ? "افزودن سند یا داکیومنت جدید به پایگاه دانش" : "Add New Knowledge Document"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "عنوان سند" : "Document Title"}
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="مثلاً: لیست قیمت و شرایط گارانتی دوره‌ها"
                className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/40"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "نوع منبع" : "Source Type"}
              </label>
              <select
                value={newSourceType}
                onChange={(e) => setNewSourceType(e.target.value)}
                className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/40"
              >
                <option value="DOC">{isFa ? "سند متنی / توضیحات (DOC)" : "Document (DOC)"}</option>
                <option value="FAQ">{isFa ? "سوالات متداول (FAQ)" : "FAQ"}</option>
                <option value="CATALOG">{isFa ? "کاتالوگ و لیست قیمت (CATALOG)" : "Catalog / Pricing"}</option>
                <option value="URL">{isFa ? "مطلب وب‌سایت (URL)" : "Website URL"}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "متن و محتوای کامل سند" : "Document Content"}
            </label>
            <textarea
              rows={4}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="اطلاعات دقیق، شرایط بازپرداخت، شرایط نوبت‌دهی یا ویژگی‌های خدمات را اینجا بنویسید..."
              className="w-full rounded border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none focus:border-accent/40"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
            >
              {isFa ? "انصراف" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={adding}
              className="rounded bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {adding ? (isFa ? "در حال پردازش و برداری‌سازی..." : "Indexing...") : (isFa ? "ایندکس و ذخیره سند" : "Save & Index")}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {documents.length === 0 ? (
          <p className="text-xs text-muted text-center py-6">
            {isFa
              ? "هنوز هیچ سندی در پایگاه دانش ثبت نشده است. با دکمه بالا اولین سند کسب‌وکار را اضافه کنید."
              : "No documents in knowledge base. Add your first document to guide the AI assistant."}
          </p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3.5 rounded border border-border bg-surface/40 hover:bg-surface/80 transition-colors"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground truncate">{doc.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/10 text-muted font-medium">
                    {doc.sourceType}
                  </span>
                  <span className="text-[10px] text-muted">
                    {doc.chunkCount} {isFa ? "بخش وکتور" : "chunks"}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 truncate max-w-xl">{doc.contentPreview}</p>
              </div>

              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deletingId === doc.id}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
              >
                {deletingId === doc.id ? (isFa ? "در حال حذف..." : "Deleting...") : (isFa ? "حذف" : "Delete")}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
