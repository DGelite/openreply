"use client";

import React from "react";
import { Section, Toggle } from "./ui-controls";

interface LeadFormSectionProps {
  leadFormEnabled: boolean;
  setLeadFormEnabled: (v: boolean) => void;
  collectName: boolean;
  setCollectName: (v: boolean) => void;
  leadPromptName: string;
  setLeadPromptName: (v: string) => void;
  collectPhone: boolean;
  setCollectPhone: (v: boolean) => void;
  leadPromptPhone: string;
  setLeadPromptPhone: (v: string) => void;
  confirmBeforeSave: boolean;
  setConfirmBeforeSave: (v: boolean) => void;
  confirmMessage: string;
  setConfirmMessage: (v: string) => void;
  collectPhoneSkipOtp: boolean;
  setCollectPhoneSkipOtp: (v: boolean) => void;
  autoVerifyAndBook: boolean;
  setAutoVerifyAndBook: (v: boolean) => void;
  leadSuccessMessage: string;
  setLeadSuccessMessage: (v: string) => void;
}

export function LeadFormSection({
  leadFormEnabled,
  setLeadFormEnabled,
  collectName,
  setCollectName,
  leadPromptName,
  setLeadPromptName,
  collectPhone,
  setCollectPhone,
  leadPromptPhone,
  setLeadPromptPhone,
  confirmBeforeSave,
  setConfirmBeforeSave,
  confirmMessage,
  setConfirmMessage,
  collectPhoneSkipOtp,
  setCollectPhoneSkipOtp,
  autoVerifyAndBook,
  setAutoVerifyAndBook,
  leadSuccessMessage,
  setLeadSuccessMessage,
}: LeadFormSectionProps) {
  return (
    <Section title="فرم دریافت مشخصات لید در دایرکت (Lead Capture Form)">
      <div className="rounded-lg border border-border p-3 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-foreground">
              دریافت مشخصات لید (نام و شماره موبایل)
            </span>
            <p className="text-xs text-muted mt-0.5">
              دریافت نام و نام خانوادگی، شماره تماس یا هر دو به صورت کاملاً ماژولار در دایرکت اینستاگرام.
            </p>
          </div>
          <Toggle
            on={leadFormEnabled}
            onToggle={() => {
              const next = !leadFormEnabled;
              setLeadFormEnabled(next);
              if (next && !collectName && !collectPhone) {
                setCollectPhone(true);
              }
            }}
          />
        </div>

        {leadFormEnabled && (
          <div className="space-y-4 pt-3 border-t border-border">
            {/* Field 1: Full Name */}
            <div className="space-y-2 rounded-lg border border-border/80 bg-surface p-3">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={collectName}
                  onChange={(e) => setCollectName(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
                />
                <span>دریافت نام و نام خانوادگی (Full Name)</span>
              </label>
              {collectName && (
                <div className="pt-2">
                  <label className="block text-xs text-muted mb-1">
                    متن پیام درخواست نام:
                  </label>
                  <input
                    type="text"
                    value={leadPromptName}
                    onChange={(e) => setLeadPromptName(e.target.value)}
                    placeholder="سلام! لطفاً اسم و فامیلتون رو برام بنویسید 🙏"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                    maxLength={300}
                  />
                </div>
              )}
            </div>

            {/* Field 2: Phone Number */}
            <div className="space-y-3 rounded-lg border border-border/80 bg-surface p-3">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={collectPhone}
                  onChange={(e) => setCollectPhone(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
                />
                <span>دریافت شماره همراه (Phone Number)</span>
              </label>

              {collectPhone && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      متن پیام درخواست شماره:
                    </label>
                    <input
                      type="text"
                      value={leadPromptPhone}
                      onChange={(e) => setLeadPromptPhone(e.target.value)}
                      placeholder="ممنون! لطفاً شماره موبایلتون رو بفرستید 📱"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                      maxLength={300}
                    />
                  </div>

                  {/* Sub-option: Confirm Phone */}
                  <div className="space-y-2 rounded border border-border/50 bg-background/50 p-2.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={confirmBeforeSave}
                        onChange={(e) => setConfirmBeforeSave(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-border text-accent focus:ring-accent/40"
                      />
                      <span>تایید شماره قبل از ثبت (پرسش «شماره شما ... است، درست است؟»)</span>
                    </label>
                    {confirmBeforeSave && (
                      <input
                        type="text"
                        value={confirmMessage}
                        onChange={(e) => setConfirmMessage(e.target.value)}
                        placeholder="شماره‌تون {phone} ثبت شد، درسته؟"
                        className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                        maxLength={300}
                      />
                    )}
                  </div>

                  {/* Sub-option: Skip OTP */}
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-muted hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={collectPhoneSkipOtp}
                      onChange={(e) => setCollectPhoneSkipOtp(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border text-accent focus:ring-accent/40"
                    />
                    <span>ثبت شماره بدون نیاز به ارسال کد پیامکی (Skip OTP)</span>
                  </label>
                </div>
              )}
            </div>

            {/* Option: Instant Verified Booking */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="autoVerifyAndBookToggle"
                  checked={autoVerifyAndBook}
                  onChange={(e) => setAutoVerifyAndBook(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500/40"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="autoVerifyAndBookToggle"
                    className="cursor-pointer font-medium text-sm text-foreground flex items-center gap-1.5"
                  >
                    <span>⚡ تایید خودکار و رزرو مستقیم در سیستم رزرواسیون</span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400 font-normal">
                      Instant Booking
                    </span>
                  </label>
                  <p className="text-xs text-muted leading-relaxed">
                    با فعال‌سازی این گزینه، شماره و اطلاعات لید در سیستم رزرواسیون (پنل admin.php) بدون نیاز به ارسال پیامک، بلافاصله در وضعیت <strong className="text-emerald-400">«تأیید شده»</strong> ثبت شده و اولین زمان خالی به عنوان نوبت رزرو به ایشان اختصاص داده می‌شود.
                  </p>
                </div>
              </div>
            </div>

            {/* Success Message */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground">
                پیام موفقیت و ثبت نهایی:
              </label>
              <input
                type="text"
                value={leadSuccessMessage}
                onChange={(e) => setLeadSuccessMessage(e.target.value)}
                placeholder="عالیه! اطلاعاتتون با موفقیت ثبت شد، خیلی زود باهاتون تماس می‌گیریم 🙏"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                maxLength={300}
              />
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
