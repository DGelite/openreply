import crypto from 'crypto';

/**
 * BoxAPI Webhook HMAC-SHA256 Signature Verifier with Replay Protection
 */
export function verifyBoxApiWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  webhookSecret: string
): { isValid: boolean; error?: string } {
  if (!signatureHeader) {
    return { isValid: false, error: 'Missing X-BoxApi-Signature header' };
  }

  // 1. Verify Replay Protection (timestamp within 5 minutes)
  if (timestampHeader) {
    const eventTimeMs = Number(timestampHeader) * 1000;
    const nowMs = Date.now();
    const toleranceMs = 5 * 60 * 1000; // 5 minutes

    if (!isNaN(eventTimeMs) && Math.abs(nowMs - eventTimeMs) > toleranceMs) {
      return { isValid: false, error: 'Webhook timestamp outside 5-minute replay window' };
    }
  }

  // 2. Compute expected HMAC
  // Signed payload format: "{timestamp}.{raw_body}"
  const signedPayload = timestampHeader ? `${timestampHeader}.${rawBody}` : rawBody;
  const expectedHash = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  const cleanSignature = signatureHeader.replace(/^sha256=/, '');

  try {
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const signatureBuffer = Buffer.from(cleanSignature, 'hex');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return { isValid: false, error: 'Invalid signature length' };
    }

    const matches = crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    return { isValid: matches, error: matches ? undefined : 'Signature mismatch' };
  } catch (err: unknown) {
    return { isValid: false, error: (err as Error)?.message || 'Signature comparison failed' };
  }
}
