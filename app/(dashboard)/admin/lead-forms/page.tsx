"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/context/language-context";

// ─── Types ──────────────────────────────────────────────────────────────────

type FieldType = "text" | "email" | "phone" | "select" | "textarea" | "checkbox" | "number" | "date";

interface LeadFormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  order: number;
}

interface LeadFormSettings {
  successMessage?: string;
  redirectUrl?: string;
  notifyEmail?: string;
  syncToCrm?: boolean;
}

interface LeadForm {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  slug: string;
  viewCount: number;
  submitCount: number;
  fields: LeadFormField[];
  settings: LeadFormSettings;
  createdAt: string;
  _count?: { submissions: number };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; labelFa: string; labelEn: string }[] = [
  { value: "text", labelFa: "متن کوتاه", labelEn: "Short Text" },
  { value: "email", labelFa: "ایمیل", labelEn: "Email" },
  { value: "phone", labelFa: "شماره تلفن", labelEn: "Phone Number" },
  { value: "number", labelFa: "عدد", labelEn: "Number" },
  { value: "textarea", labelFa: "متن بلند", labelEn: "Long Text" },
  { value: "select", labelFa: "انتخاب از لیست", labelEn: "Dropdown Select" },
  { value: "checkbox", labelFa: "چک‌باکس", labelEn: "Checkbox" },
  { value: "date", labelFa: "تاریخ", labelEn: "Date" },
];

function generateFieldId(): string {
  return `field_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldEditor({
  field,
  isFa,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  field: LeadFormField;
  isFa: boolean;
  onChange: (updated: LeadFormField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [optionsText, setOptionsText] = useState(field.options?.join("\n") || "");

  function update(patch: Partial<LeadFormField>) {
    onChange({ ...field, ...patch });
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-surface/60 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              {isFa ? "نوع فیلد" : "Field Type"}
            </label>
            <select
              value={field.type}
              onChange={(e) => update({ type: e.target.value as FieldType })}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {isFa ? ft.labelFa : ft.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              {isFa ? "عنوان فیلد" : "Field Label"}
            </label>
            <input
              type="text"
              value={field.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder={isFa ? "مثال: نام و نام خانوادگی" : "e.g. Full Name"}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted mb-1">
              {isFa ? "متن راهنما (Placeholder)" : "Placeholder Text"}
            </label>
            <input
              type="text"
              value={field.placeholder || ""}
              onChange={(e) => update({ placeholder: e.target.value })}
              placeholder={isFa ? "مثال: نام خود را وارد کنید..." : "e.g. Enter your full name..."}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          {field.type === "select" && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted mb-1">
                {isFa ? "گزینه‌ها (هر گزینه در یک خط)" : "Options (one per line)"}
              </label>
              <textarea
                rows={3}
                value={optionsText}
                onChange={(e) => {
                  setOptionsText(e.target.value);
                  update({ options: e.target.value.split("\n").filter(Boolean) });
                }}
                placeholder={isFa ? "گزینه اول\nگزینه دوم\nگزینه سوم" : "Option One\nOption Two\nOption Three"}
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent resize-none"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 pt-5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Move up"
            className="p-1.5 rounded border border-border text-muted hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            title="Move down"
            className="p-1.5 rounded border border-border text-muted hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete field"
            className="p-1.5 rounded border border-error/30 text-error hover:bg-error/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => update({ required: e.target.checked })}
          className="rounded border-border text-accent focus:ring-accent h-4 w-4"
        />
        <span className="text-xs font-medium text-foreground">
          {isFa ? "این فیلد اجباری است" : "Required field"}
        </span>
      </label>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type ViewMode = "list" | "builder" | "submissions";

export default function LeadFormsAdminPage() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [view, setView] = useState<ViewMode>("list");
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedForm, setSelectedForm] = useState<LeadForm | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Builder state
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editFields, setEditFields] = useState<LeadFormField[]>([]);
  const [editSettings, setEditSettings] = useState<LeadFormSettings>({
    successMessage: "اطلاعات شما با موفقیت ثبت شد. متشکریم!",
    syncToCrm: true,
  });
  const [editActive, setEditActive] = useState(true);

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/lead-forms");
      const data = await res.json();
      if (data.success) setForms(data.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  function openNewBuilder() {
    setSelectedForm(null);
    setEditTitle("");
    setEditDesc("");
    setEditFields([]);
    setEditSettings({ successMessage: "اطلاعات شما با موفقیت ثبت شد. متشکریم!", syncToCrm: true });
    setEditActive(true);
    setMessage(null);
    setView("builder");
  }

  function openEditBuilder(form: LeadForm) {
    setSelectedForm(form);
    setEditTitle(form.title);
    setEditDesc(form.description || "");
    setEditFields((form.fields || []).slice().sort((a, b) => a.order - b.order));
    setEditSettings(form.settings || {});
    setEditActive(form.isActive);
    setMessage(null);
    setView("builder");
  }

  function addField() {
    const newField: LeadFormField = {
      id: generateFieldId(),
      type: "text",
      label: isFa ? "فیلد جدید" : "New Field",
      placeholder: "",
      required: false,
      order: editFields.length,
    };
    setEditFields((prev) => [...prev, newField]);
  }

  function updateField(index: number, updated: LeadFormField) {
    setEditFields((prev) => prev.map((f, i) => (i === index ? updated : f)));
  }

  function deleteField(index: number) {
    setEditFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: "up" | "down") {
    setEditFields((prev) => {
      const arr = [...prev];
      const swapWith = direction === "up" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= arr.length) return arr;
      [arr[index], arr[swapWith]] = [arr[swapWith], arr[index]];
      return arr.map((f, i) => ({ ...f, order: i }));
    });
  }

  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!editTitle.trim()) {
      setMessage({ type: "error", text: isFa ? "عنوان فرم الزامی است." : "Form title is required." });
      return;
    }
    if (editFields.length === 0) {
      setMessage({ type: "error", text: isFa ? "حداقل یک فیلد اضافه کنید." : "Add at least one field." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        title: editTitle,
        description: editDesc,
        fields: editFields.map((f, i) => ({ ...f, order: i })),
        settings: editSettings,
        isActive: editActive,
      };

      const url = selectedForm
        ? `/api/admin/lead-forms/${selectedForm.id}`
        : "/api/admin/lead-forms";

      const res = await fetch(url, {
        method: selectedForm ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: isFa ? "فرم با موفقیت ذخیره شد." : "Form saved successfully.",
        });
        await loadForms();
        setTimeout(() => setView("list"), 1200);
      } else {
        setMessage({ type: "error", text: data.error || (isFa ? "خطا در ذخیره." : "Save failed.") });
      }
    } catch {
      setMessage({ type: "error", text: isFa ? "خطا در برقراری ارتباط." : "Connection error." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteForm(formId: string) {
    if (!confirm(isFa ? "آیا از حذف این فرم اطمینان دارید؟" : "Delete this form?")) return;
    try {
      await fetch(`/api/admin/lead-forms/${formId}`, { method: "DELETE" });
      await loadForms();
    } catch {
      // silently fail
    }
  }

  async function toggleFormActive(form: LeadForm) {
    try {
      await fetch(`/api/admin/lead-forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !form.isActive }),
      });
      await loadForms();
    } catch {
      // silently fail
    }
  }

  // ─── Render: List View ────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isFa ? "سازنده فرم لید (Lead Form Builder)" : "Lead Form Builder"}
            </h1>
            <p className="text-sm text-muted mt-1">
              {isFa
                ? "فرم‌های اختصاصی برای جمع‌آوری لید از طریق لینک، DM، یا امبد در سایت"
                : "Create custom forms to capture leads via link, DM flow, or website embed."}
            </p>
          </div>
          <button
            onClick={openNewBuilder}
            className="px-5 py-2.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            {isFa ? "+ فرم جدید" : "+ New Form"}
          </button>
        </div>

        {loading ? (
          <div className="panel rounded p-8 h-48 animate-pulse bg-surface/50" />
        ) : forms.length === 0 ? (
          <div className="panel rounded p-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-foreground font-medium text-base mb-1">
              {isFa ? "هنوز هیچ فرمی ساخته نشده" : "No forms yet"}
            </p>
            <p className="text-sm text-muted mb-6">
              {isFa
                ? "اولین فرم خود را بسازید تا لیدهای واقعی جمع‌آوری کنید."
                : "Create your first form to start capturing real leads."}
            </p>
            <button
              onClick={openNewBuilder}
              className="px-6 py-2.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-semibold"
            >
              {isFa ? "ساخت اولین فرم" : "Create First Form"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {forms.map((form) => (
              <div
                key={form.id}
                className="panel rounded p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${form.isActive ? "bg-success" : "bg-muted"}`}
                    />
                    <h3 className="font-semibold text-foreground text-base">{form.title}</h3>
                  </div>
                  {form.description && (
                    <p className="text-xs text-muted truncate max-w-md">{form.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted">
                    <span>👁 {form.viewCount} {isFa ? "بازدید" : "views"}</span>
                    <span>📨 {form.submitCount} {isFa ? "ثبت" : "submissions"}</span>
                    <span>🔗 /f/{form.slug}</span>
                    <span>{(form.fields || []).length} {isFa ? "فیلد" : "fields"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleFormActive(form)}
                    className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                      form.isActive
                        ? "border-success/30 text-success hover:bg-success/10"
                        : "border-muted/30 text-muted hover:bg-surface"
                    }`}
                  >
                    {form.isActive ? (isFa ? "فعال" : "Active") : (isFa ? "غیرفعال" : "Inactive")}
                  </button>
                  <button
                    onClick={() => openEditBuilder(form)}
                    className="px-3 py-1.5 rounded text-xs font-medium border border-border text-foreground hover:border-accent/50 transition-colors"
                  >
                    {isFa ? "ویرایش" : "Edit"}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedForm(form);
                      setView("submissions");
                    }}
                    className="px-3 py-1.5 rounded text-xs font-medium border border-border text-foreground hover:border-accent/50 transition-colors"
                  >
                    {isFa ? "ثبت‌شده‌ها" : "Submissions"}
                  </button>
                  <button
                    onClick={() => handleDeleteForm(form.id)}
                    className="px-3 py-1.5 rounded text-xs font-medium border border-error/30 text-error hover:bg-error/10 transition-colors"
                  >
                    {isFa ? "حذف" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Submissions View ─────────────────────────────────────────────

  if (view === "submissions" && selectedForm) {
    return (
      <SubmissionsView
        form={selectedForm}
        isFa={isFa}
        onBack={() => setView("list")}
      />
    );
  }

  // ─── Render: Builder View ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setView("list")}
          className="p-2 rounded border border-border text-muted hover:text-foreground hover:border-border/80 transition-colors text-sm"
        >
          ← {isFa ? "بازگشت" : "Back"}
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {selectedForm
              ? (isFa ? "ویرایش فرم" : "Edit Form")
              : (isFa ? "ساخت فرم جدید" : "Create New Form")}
          </h1>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded border text-sm font-medium ${
            message.type === "success"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-error/10 border-error/30 text-error"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSaveForm} className="space-y-6">
        {/* Form Meta */}
        <section className="panel rounded p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-semibold text-foreground">
              {isFa ? "اطلاعات پایه فرم" : "Form Details"}
            </h2>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "عنوان فرم *" : "Form Title *"}
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={isFa ? "مثال: فرم ثبت‌نام مشاوره رایگان" : "e.g. Free Consultation Sign-up Form"}
                required
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "توضیحات فرم (اختیاری)" : "Description (Optional)"}
              </label>
              <textarea
                rows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder={isFa ? "توضیح کوتاه برای کاربر..." : "Short description shown to users..."}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent resize-none"
              />
            </div>
          </div>
        </section>

        {/* Field Builder */}
        <section className="panel rounded p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-semibold text-foreground">
              {isFa ? "فیلدهای فرم" : "Form Fields"}
            </h2>
            <button
              type="button"
              onClick={addField}
              className="px-4 py-1.5 rounded border border-accent text-accent text-xs font-semibold hover:bg-accent hover:text-white transition-colors"
            >
              {isFa ? "+ افزودن فیلد" : "+ Add Field"}
            </button>
          </div>

          {editFields.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-border rounded-lg">
              <p className="text-muted text-sm">
                {isFa
                  ? "هنوز هیچ فیلدی اضافه نشده. روی «افزودن فیلد» کلیک کنید."
                  : "No fields yet. Click \"Add Field\" to start building."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {editFields.map((field, idx) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  isFa={isFa}
                  onChange={(updated) => updateField(idx, updated)}
                  onDelete={() => deleteField(idx)}
                  onMoveUp={() => moveField(idx, "up")}
                  onMoveDown={() => moveField(idx, "down")}
                  isFirst={idx === 0}
                  isLast={idx === editFields.length - 1}
                />
              ))}
            </div>
          )}
        </section>

        {/* Settings */}
        <section className="panel rounded p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-3">
            {isFa ? "تنظیمات فرم" : "Form Settings"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "پیام موفقیت پس از ثبت" : "Success Message After Submission"}
              </label>
              <input
                type="text"
                value={editSettings.successMessage || ""}
                onChange={(e) =>
                  setEditSettings((s) => ({ ...s, successMessage: e.target.value }))
                }
                placeholder={isFa ? "اطلاعات شما با موفقیت ثبت شد!" : "Thank you! We'll be in touch."}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "آدرس ریدایرکت (اختیاری)" : "Redirect URL (Optional)"}
              </label>
              <input
                type="url"
                value={editSettings.redirectUrl || ""}
                onChange={(e) =>
                  setEditSettings((s) => ({ ...s, redirectUrl: e.target.value }))
                }
                placeholder="https://yoursite.com/thank-you"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "ایمیل اطلاع‌رسانی (اختیاری)" : "Notify Email (Optional)"}
              </label>
              <input
                type="email"
                value={editSettings.notifyEmail || ""}
                onChange={(e) =>
                  setEditSettings((s) => ({ ...s, notifyEmail: e.target.value }))
                }
                placeholder="admin@example.com"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={editSettings.syncToCrm ?? true}
              onChange={(e) =>
                setEditSettings((s) => ({ ...s, syncToCrm: e.target.checked }))
              }
              className="rounded border-border text-accent focus:ring-accent h-4 w-4"
            />
            <span className="text-sm font-medium text-foreground">
              {isFa
                ? "ارسال خودکار لیدها به PHP CRM (admin.php)"
                : "Auto-sync submissions to PHP CRM (admin.php)"}
            </span>
          </label>
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setView("list")}
            className="px-5 py-2.5 rounded border border-border text-foreground text-sm font-medium hover:bg-surface transition-colors"
          >
            {isFa ? "انصراف" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving
              ? (isFa ? "در حال ذخیره..." : "Saving...")
              : (isFa ? "ذخیره فرم" : "Save Form")}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Submissions Sub-Page ─────────────────────────────────────────────────────

function SubmissionsView({
  form,
  isFa,
  onBack,
}: {
  form: LeadForm;
  isFa: boolean;
  onBack: () => void;
}) {
  interface Submission {
    id: string;
    data: Record<string, unknown>;
    syncedToCrm: boolean;
    createdAt: string;
  }

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/lead-forms/${form.id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setSubmissions(res.data.submissions || []);
      })
      .finally(() => setLoading(false));
  }, [form.id]);

  const fieldDefs = (form.fields || []).slice().sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded border border-border text-muted hover:text-foreground transition-colors text-sm"
        >
          ← {isFa ? "بازگشت" : "Back"}
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isFa ? `ثبت‌شده‌های فرم: ${form.title}` : `Submissions: ${form.title}`}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {submissions.length} {isFa ? "رکورد" : "records"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="panel rounded p-8 h-48 animate-pulse bg-surface/50" />
      ) : submissions.length === 0 ? (
        <div className="panel rounded p-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-foreground font-medium">
            {isFa ? "هنوز هیچ ثبتی انجام نشده" : "No submissions yet"}
          </p>
        </div>
      ) : (
        <div className="panel rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-muted">#</th>
                  {fieldDefs.map((f) => (
                    <th key={f.id} className="text-left p-3 text-xs font-semibold text-muted whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  <th className="text-left p-3 text-xs font-semibold text-muted">
                    {isFa ? "CRM" : "CRM"}
                  </th>
                  <th className="text-left p-3 text-xs font-semibold text-muted">
                    {isFa ? "تاریخ" : "Date"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, i) => (
                  <tr key={sub.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                    <td className="p-3 text-muted">{i + 1}</td>
                    {fieldDefs.map((f) => (
                      <td key={f.id} className="p-3 text-foreground max-w-[200px] truncate">
                        {String(sub.data[f.id] ?? "-")}
                      </td>
                    ))}
                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          sub.syncedToCrm
                            ? "bg-success/10 text-success"
                            : "bg-muted/10 text-muted"
                        }`}
                      >
                        {sub.syncedToCrm ? "✓" : "–"}
                      </span>
                    </td>
                    <td className="p-3 text-muted text-xs whitespace-nowrap">
                      {new Date(sub.createdAt).toLocaleString(isFa ? "fa-IR" : "en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
