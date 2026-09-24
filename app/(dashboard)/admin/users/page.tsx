"use client";

import React, { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";

interface UserItem {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  role?: string;
  systemRole?: string;
  createdAt: string;
}

export default function UsersAdminPage() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER");

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setName("");
        setEmail("");
        setPassword("");
        void loadUsers();
      }
    } catch (err) {
      console.error("Failed to create user", err);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isFa ? "مدیریت کاربران" : "User Management"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {isFa ? "مشاهده لیست کاربران و تعریف حساب جدید با نقش‌های دسترسی" : "View users and provision new workspace accounts."}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
        >
          {isFa ? "+ افزودن کاربر جدید" : "+ Create New User"}
        </button>
      </div>

      <div className="panel rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                <th className={`px-6 py-4 font-semibold ${isFa ? "text-right" : "text-left"}`}>
                  {isFa ? "نام کاربر" : "User Name"}
                </th>
                <th className={`px-6 py-4 font-semibold ${isFa ? "text-right" : "text-left"}`}>
                  {isFa ? "ایمیل" : "Email"}
                </th>
                <th className={`px-6 py-4 font-semibold ${isFa ? "text-right" : "text-left"}`}>
                  {isFa ? "نقش دسترسی" : "Role"}
                </th>
                <th className={`px-6 py-4 font-semibold ${isFa ? "text-right" : "text-left"}`}>
                  {isFa ? "تاریخ ثبت‌نام" : "Created At"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted">
                    {isFa ? "در حال دریافت..." : "Loading..."}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted">
                    {isFa ? "هیچ کاربری یافت نشد." : "No users found."}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-hover/50">
                    <td className="px-6 py-4 font-medium text-foreground">
                      {u.name || u.username || (isFa ? "بدون نام" : "Unnamed")}
                    </td>
                    <td className="px-6 py-4 text-muted">{u.email || u.username}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          (u.systemRole || u.role || "").includes("ADMIN")
                            ? "bg-accent/10 text-accent border border-accent/20"
                            : "bg-surface text-muted border border-border"
                        }`}
                      >
                        {u.systemRole || u.role || "USER"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted">
                      {new Date(u.createdAt).toLocaleDateString(isFa ? "fa-IR" : "en-US")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="panel rounded p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {isFa ? "افزودن کاربر جدید" : "Create New User"}
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "نام و نام خانوادگی" : "Full Name"}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "آدرس ایمیل" : "Email Address"}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "کلمه عبور" : "Password"}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "نقش دسترسی" : "Role"}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  <option value="USER">{isFa ? "کاربر عادی (User)" : "Regular User"}</option>
                  <option value="ADMIN">{isFa ? "مدیر کل (Admin)" : "Administrator"}</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded border border-border text-sm text-muted hover:text-foreground"
                >
                  {isFa ? "انصراف" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-accent hover:bg-accent-hover text-white text-sm font-medium"
                >
                  {isFa ? "ایجاد کاربر" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
