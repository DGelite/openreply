import { PhpBookingClient } from "../lib/services/php-booking-client";

async function runIntegrationTest() {
  console.log("=====================================================");
  console.log("🧪 OpenReply TypeScript SDK <-> PHP API Integration Test");
  console.log("=====================================================\n");

  const client = new PhpBookingClient(
    "http://localhost/api_openreply.php",
    "de_secure_api_key_2026_x892n3m"
  );

  // 1. Fetch available slots
  console.log("1. Testing getAvailableSlots()...");
  const slotsRes = await client.getAvailableSlots();
  console.log(`   ✅ Success! Date: ${slotsRes.date}, Total Slots: ${slotsRes.slots.length}`);

  // 2. Request OTP
  console.log("\n2. Testing requestBookingOtp()...");
  const testPhone = "0912" + Math.floor(1000000 + Math.random() * 9000000);
  const otpRes = await client.requestBookingOtp({
    phone: testPhone,
    full_name: "تستر اختصاصی TS SDK",
    instagram_handle: "ts_sdk_user",
    utm_source: "ts_integration_test",
  });
  console.log(`   ✅ Success! Waitlist ID: ${otpRes.waitlist_id}, OTP: ${otpRes.debug_otp}`);

  // 3. Confirm booking
  console.log("\n3. Testing confirmBooking()...");
  const confirmRes = await client.confirmBooking({
    waitlist_id: otpRes.waitlist_id,
    otp: otpRes.debug_otp || "12345",
    appointment_time: new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace("T", " "),
  });

  console.log(`   ✅ Success! CRM Lead ID: ${confirmRes.crm_lead_id}, Score: ${confirmRes.lead_score}, Assigned Agent: ${confirmRes.assigned_agent_name}`);

  console.log("\n=====================================================");
  console.log("🎉 TypeScript SDK Integration Test Completed 100%!");
  console.log("=====================================================");
}

runIntegrationTest().catch((err) => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
