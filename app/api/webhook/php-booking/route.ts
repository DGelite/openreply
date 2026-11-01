import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";

/**
 * Inbound Webhook Endpoint for PHP Reservation & CRM System
 *
 * Receives real-time events from Digital Elite PHP Booking System:
 * - ping (Live diagnostic test)
 * - booking.confirmed (Appointment confirmed via OTP or web)
 * - crm.status_changed (Sales agent update or lead stage change)
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") || "";
    const timestamp = req.headers.get("x-timestamp") || "";
    const authHeader = req.headers.get("authorization") || "";

    const secret =
      process.env.OPENREPLY_WEBHOOK_SECRET ||
      process.env.PHP_ADMIN_API_SECRET ||
      "de_secure_api_key_2026_x892n3m";

    // ── Security Verification ────────────────────────────────────────────────
    let isAuthorized = false;

    // 1. Bearer Token Check
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const tokenBuf = Buffer.from(token);
      const secretBuf = Buffer.from(secret);
      if (tokenBuf.length === secretBuf.length && crypto.timingSafeEqual(tokenBuf, secretBuf)) {
        isAuthorized = true;
      }
    }

    // 2. HMAC-SHA256 Signature Check
    if (!isAuthorized && signature && timestamp) {
      const now = Math.floor(Date.now() / 1000);
      const reqTime = parseInt(timestamp, 10);

      // Replay attack prevention: 5-minute window
      if (Math.abs(now - reqTime) <= 300) {
        const expectedSignature = crypto
          .createHmac("sha256", secret)
          .update(`${timestamp}.${rawBody}`)
          .digest("hex");

        if (
          signature.length === expectedSignature.length &&
          crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
        ) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "امضای دیجیتال یا کلید دسترسی نامعتبر است." },
        { status: 401 }
      );
    }

    // ── Parse Event Payload ──────────────────────────────────────────────────
    const payload = JSON.parse(rawBody || "{}");
    const event = payload.event || "unknown";
    const data = payload.data || {};

    // 1. Handle Ping Diagnostic
    if (event === "ping") {
      return NextResponse.json({
        success: true,
        message: "ارتباط با وب‌هوک OpenReply کاملاً برقرار و سالم است.",
        received_at: new Date().toISOString(),
        version: "2.0-enterprise",
      });
    }

    // 2. Handle Booking Confirmed Event
    if (event === "booking.confirmed") {
      const phone = data.phone;
      const fullName = data.full_name;
      const igHandle = data.instagram_handle;
      const apptTime = data.appointment_time;

      // Non-blocking telemetry log
      prisma.operationalEvent
        .create({
          data: {
            source: "WORKER",
            level: "INFO",
            message: `PHP Booking Confirmed: ${fullName} (${phone}) - Appt: ${apptTime}`,
            payload: data,
          },
        })
        .catch(() => {
          // Operational log failure should never block webhook response
        });

      return NextResponse.json({
        success: true,
        event: "booking.confirmed",
        message: "رویداد نوبت با موفقیت در OpenReply ثبت شد.",
      });
    }

    // 3. Handle CRM Status Changed Event
    if (event === "crm.status_changed") {
      // Non-blocking telemetry log
      prisma.operationalEvent
        .create({
          data: {
            source: "WORKER",
            level: "INFO",
            message: `CRM Status Changed: Lead #${data.crm_lead_id} -> ${data.new_status}`,
            payload: data,
          },
        })
        .catch(() => {
          // Operational log failure should never block webhook response
        });

      return NextResponse.json({
        success: true,
        event: "crm.status_changed",
        message: "تغییر وضعیت CRM دریافت شد.",
      });
    }

    return NextResponse.json({
      success: true,
      event,
      message: "رویداد دریافت شد.",
    });
  } catch (error) {
    console.error("[PHP Booking Webhook Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "خطای ناشناخته در پردازش وب‌هوک",
      },
      { status: 400 }
    );
  }
}
