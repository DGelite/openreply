import { NextResponse } from "next/server";
import { phpBookingClient } from "@/lib/services/php-booking-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;

    const data = await phpBookingClient.getAvailableSlots(date);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch slots";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
