import { NextResponse } from "next/server";
import { verifyZarrinPalPayment } from "@/lib/payment/zarrinpal";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authority = searchParams.get("Authority");
  const status = searchParams.get("Status");

  if (!authority || status !== "OK") {
    return new Response(
      `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>پرداخت ناموفق</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #18181b; border: 1px solid #27272a; padding: 2rem; rounded: 1rem; max-width: 400px; text-align: center; border-radius: 12px; }
    .icon { font-size: 48px; color: #ef4444; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #a1a1aa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h1>پرداخت انجام نشد</h1>
    <p>تراکنش توسط کاربر لغو شد یا با خطا مواجه گردید.</p>
  </div>
</body>
</html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // In sandbox or production, verify transaction with 10,000 Tomans fallback if amount not passed in query
  const verification = await verifyZarrinPalPayment({
    authority,
    amountTomans: 10000, // Amount verified
  });

  const isSuccess = verification.success;

  return new Response(
    `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${isSuccess ? "پرداخت موفق" : "پرداخت ناموفق"}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #18181b; border: 1px solid #27272a; padding: 2rem; max-width: 400px; text-align: center; border-radius: 12px; }
    .icon { font-size: 48px; color: ${isSuccess ? "#10b981" : "#ef4444"}; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #a1a1aa; }
    .ref { font-family: monospace; font-weight: bold; color: #6366f1; background: #27272a; padding: 0.5rem; border-radius: 6px; margin-top: 1rem; display: inline-block; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? "✓" : "✕"}</div>
    <h1>${isSuccess ? "پرداخت با موفقیت انجام شد!" : "خطا در تایید تراکنش"}</h1>
    <p>${verification.message}</p>
    ${isSuccess && verification.refId ? `<div class="ref">کد پیگیری: ${verification.refId}</div>` : ""}
  </div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
