import { NextResponse } from "next/server";
import { phpBookingClient } from "@/lib/services/php-booking-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.waitlist_id || !body.otp) {
      return NextResponse.json({ success: false, error: "شناسه رزرو و کد تایید الزامی است." }, { status: 400 });
    }

    const data = await phpBookingClient.confirmBooking(body);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm booking";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
