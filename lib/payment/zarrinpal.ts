/**
 * OpenReply ZarrinPal Payment Gateway Client (v4)
 * Tailored for Iranian businesses, supporting Tomans/Rials,
 * ZarrinPal payment request, StartPay URL generation, and callback verification.
 */

export interface ZarrinPalRequestPayload {
  merchantId?: string;
  amountTomans: number;
  description: string;
  callbackUrl: string;
  mobile?: string;
  email?: string;
  isSandbox?: boolean;
}

export interface ZarrinPalRequestResult {
  success: boolean;
  authority?: string;
  paymentUrl?: string;
  code?: number;
  message?: string;
}

export interface ZarrinPalVerifyPayload {
  merchantId?: string;
  amountTomans: number;
  authority: string;
  isSandbox?: boolean;
}

export interface ZarrinPalVerifyResult {
  success: boolean;
  refId?: number | string;
  cardPan?: string;
  code?: number;
  message?: string;
}

const ZARRINPAL_MERCHANT_ID =
  process.env.ZARRINPAL_MERCHANT_ID || "00000000-0000-0000-0000-000000000000";

/**
 * Initiates a ZarrinPal payment request and returns the payment URL.
 */
export async function requestZarrinPalPayment(
  payload: ZarrinPalRequestPayload
): Promise<ZarrinPalRequestResult> {
  const merchantId = payload.merchantId || ZARRINPAL_MERCHANT_ID;
  const isSandbox = payload.isSandbox ?? (process.env.NODE_ENV !== "production");

  const baseUrl = isSandbox
    ? "https://sandbox.zarrinpal.com/pg/v4/payment"
    : "https://api.zarrinpal.com/pg/v4/payment";

  const startPayBaseUrl = isSandbox
    ? "https://sandbox.zarrinpal.com/pg/StartPay"
    : "https://www.zarrinpal.com/pg/StartPay";

  // ZarrinPal API v4 expects amount in Tomans or Rials (1 Toman = 10 Rials). Standard is Tomans in v4 request.
  const body = {
    merchant_id: merchantId,
    amount: payload.amountTomans,
    description: payload.description,
    callback_url: payload.callbackUrl,
    metadata: {
      mobile: payload.mobile || "",
      email: payload.email || "",
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${baseUrl}/request.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const json = await response.json();

    if (json.data && (json.data.code === 100 || json.data.code === 101)) {
      const authority = json.data.authority;
      return {
        success: true,
        authority,
        paymentUrl: `${startPayBaseUrl}/${authority}`,
        code: json.data.code,
      };
    }

    const errorCode = json.errors?.code || json.data?.code || -1;
    const errorMessage = json.errors?.message || "خطا در برقراری ارتباط با زرین‌پال";

    return {
      success: false,
      code: errorCode,
      message: errorMessage,
    };
  } catch (error) {
    console.error("[ZarrinPal Payment Request Error]:", error);
    return {
      success: false,
      code: -99,
      message: "خطا در اتصال به درگاه پرداخت زرین‌پال",
    };
  }
}

/**
 * Verifies a ZarrinPal payment after callback.
 */
export async function verifyZarrinPalPayment(
  payload: ZarrinPalVerifyPayload
): Promise<ZarrinPalVerifyResult> {
  const merchantId = payload.merchantId || ZARRINPAL_MERCHANT_ID;
  const isSandbox = payload.isSandbox ?? (process.env.NODE_ENV !== "production");

  const baseUrl = isSandbox
    ? "https://sandbox.zarrinpal.com/pg/v4/payment"
    : "https://api.zarrinpal.com/pg/v4/payment";

  const body = {
    merchant_id: merchantId,
    amount: payload.amountTomans,
    authority: payload.authority,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${baseUrl}/verify.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const json = await response.json();

    if (json.data && (json.data.code === 100 || json.data.code === 101)) {
      return {
        success: true,
        refId: json.data.ref_id,
        cardPan: json.data.card_pan,
        code: json.data.code,
        message: json.data.code === 101 ? "پرداخت قبلاً تایید شده است." : "پرداخت با موفقیت انجام شد.",
      };
    }

    return {
      success: false,
      code: json.errors?.code || json.data?.code || -1,
      message: json.errors?.message || "تایید پرداخت ناموفق بود.",
    };
  } catch (error) {
    console.error("[ZarrinPal Verify Error]:", error);
    return {
      success: false,
      code: -99,
      message: "خطا در تایید تراکنش درگاه زرین‌پال",
    };
  }
}
