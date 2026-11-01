---
trigger: model_decision
description: "Rules for communication with the PHP Booking ERP, HMAC signature verification, and circuit breaker."
---

# PHP Booking Bridge Resilience Rules

> **Implementation:** [`lib/services/php-booking-client.ts`](file:///I:/Desktop/openreply-main/lib/services/php-booking-client.ts)  
> **Inbound Webhook:** [`app/api/webhook/php-booking/route.ts`](file:///I:/Desktop/openreply-main/app/api/webhook/php-booking/route.ts)

1. **Strict Client Usage:** All outbound calls to the Booking system must route through `PhpBookingClient`. Direct `fetch()` calls bypassing the circuit breaker are prohibited.
2. **Circuit Breaker:** Honor the 60-second cooldown and 8-second request timeout. In case of Booking failure, queue the message and do not crash the Next.js API or worker.
3. **Cryptographic Validation:** Incoming webhooks from Booking must verify HMAC-SHA256 signatures (`x-signature`) and ensure timestamps are within a 300-second window.
