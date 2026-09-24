import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { requestZarrinPalPayment } from "@/lib/payment/zarrinpal";

export async function POST(request: Request) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amountTomans, description, mobile, email } = body;

    if (!amountTomans || typeof amountTomans !== "number" || amountTomans <= 0) {
      return NextResponse.json(
        { error: "مبلغ تومان معتبر الزامی است." },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const callbackUrl = `${origin}/api/payment/zarrinpal/callback`;

    const result = await requestZarrinPalPayment({
      amountTomans,
      description: description || "پرداخت سفارش اتوماسیون اینستاگرام",
      callbackUrl,
      mobile,
      email,
    });

    if (result.success && result.paymentUrl) {
      return NextResponse.json({
        success: true,
        authority: result.authority,
        paymentUrl: result.paymentUrl,
      });
    }

    return NextResponse.json(
      { error: result.message || "خطا در اتصال به درگاه پرداخت" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Payment Route Error]:", error);
    return NextResponse.json(
      { error: "خطای سرور در ایجاد لینک پرداخت" },
      { status: 500 }
    );
  }
}
