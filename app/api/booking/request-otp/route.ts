import { NextResponse } from "next/server";
import { phpBookingClient } from "@/lib/services/php-booking-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.phone) {
      return NextResponse.json({ success: false, error: "شماره تلفن الزامی است." }, { status: 400 });
    }

    const data = await phpBookingClient.requestBookingOtp(body);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to request OTP";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
