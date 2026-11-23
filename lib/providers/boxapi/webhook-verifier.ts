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
  const cleanSignature = signatureHeader.replace(/^sha256=/, '').trim();
  const candidateSecrets = Array.from(
    new Set([
      webhookSecret,
      webhookSecret.startsWith('whsec_') ? webhookSecret.slice(6) : `whsec_${webhookSecret}`,
    ])
  ).filter(Boolean);

  const signedPayloads = [
    timestampHeader ? `${timestampHeader}.${rawBody}` : rawBody,
    rawBody,
  ];

  for (const secret of candidateSecrets) {
    for (const payload of signedPayloads) {
      try {
        const expectedHash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');

        const expectedBuffer = Buffer.from(expectedHash, 'hex');
        const signatureBuffer = Buffer.from(cleanSignature, 'hex');

        if (
          expectedBuffer.length === signatureBuffer.length &&
          crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
        ) {
          return { isValid: true };
        }
      } catch {
        // continue trying
      }
    }
  }

  return { isValid: false, error: 'Signature mismatch' };
}
