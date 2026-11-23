import { describe, it, expect, vi, beforeEach } from "vitest";
import { phpBookingClient } from "@/lib/services/php-booking-client";
import { syncLeadToWampCrm } from "@/lib/automation/crm-sync";

describe("Campaign Lead Capture Form & Instant Booking Bridge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("passes auto_verify_and_book flag correctly when syncing to PHP CRM", async () => {
    const syncSpy = vi.spyOn(phpBookingClient, "syncLead").mockResolvedValue({
      success: true,
      crm_lead_id: 888,
      waitlist_id: 999,
      lead_score: 15,
      message: "Lead verified and appointment booked",
    });

    const result = await syncLeadToWampCrm({
      leadId: "lead_test_auto_verify",
      phone: "09121112233",
      full_name: "مخاطب تست رزرو فوری",
      username: "test_ig_user",
      auto_verify_and_book: true,
      appointment_time: "2026-11-25 14:00:00",
    });

    expect(result).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "09121112233",
        full_name: "مخاطب تست رزرو فوری",
        auto_verify_and_book: true,
        appointment_time: "2026-11-25 14:00:00",
      })
    );
  });

  it("supports syncing name-only leads with auto_verify_and_book", async () => {
    const syncSpy = vi.spyOn(phpBookingClient, "syncLead").mockResolvedValue({
      success: true,
      crm_lead_id: 889,
      waitlist_id: 1000,
      lead_score: 5,
      message: "Name-only lead synced",
    });

    const result = await syncLeadToWampCrm({
      leadId: "lead_name_only",
      full_name: "فقط نام کاربر",
      username: "name_user",
      auto_verify_and_book: true,
    });

    expect(result).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "فقط نام کاربر",
        auto_verify_and_book: true,
      })
    );
  });

  it("supports syncing phone-only leads with auto_verify_and_book", async () => {
    const syncSpy = vi.spyOn(phpBookingClient, "syncLead").mockResolvedValue({
      success: true,
      crm_lead_id: 890,
      waitlist_id: 1001,
      lead_score: 10,
      message: "Phone-only lead synced",
    });

    const result = await syncLeadToWampCrm({
      leadId: "lead_phone_only",
      phone: "09351234567",
      username: "phone_user",
      auto_verify_and_book: false,
    });

    expect(result).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "09351234567",
        auto_verify_and_book: false,
      })
    );
  });
});
