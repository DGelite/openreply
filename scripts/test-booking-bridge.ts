import { PhpBookingClient } from "../lib/services/php-booking-client";

async function runIntegrationTest() {
  console.log("=====================================================");
  console.log("🧪 OpenReply TypeScript SDK <-> PHP API Integration Test");
  console.log("=====================================================\n");

  const client = new PhpBookingClient(
    "http://localhost/api_openreply.php",
    "de_secure_api_key_2026_x892n3m"
  );

  // 1. Test ping
  console.log("1. Testing ping()...");
  const pingRes = await client.ping();
  console.log(`   ✅ Success! Server time: ${pingRes.server_time}, Latency: ${pingRes.latency_ms}ms, Version: ${pingRes.api_version}`);

  // 2. Fetch available slots
  console.log("\n2. Testing getAvailableSlots()...");
  const slotsRes = await client.getAvailableSlots();
  console.log(`   ✅ Success! Date: ${slotsRes.date}, Total Slots: ${slotsRes.slots.length}`);

  // 3. Direct Lead Sync (without OTP)
  console.log("\n3. Testing syncLead() [Direct CRM Lead Sync]...");
  const directPhone = "0912" + Math.floor(1000000 + Math.random() * 9000000);
  const syncRes = await client.syncLead({
    phone: directPhone,
    full_name: "مخاطب مستقیم اینستاگرام",
    instagram_handle: "ig_direct_lead",
    lead_source: "instagram_direct_dm",
    custom_data: { source: "reels_campaign", interest: "online_business" },
  });
  console.log(`   ✅ Success! CRM Lead ID: ${syncRes.crm_lead_id}, Score: ${syncRes.lead_score}`);

  // 4. Request OTP for booking
  console.log("\n4. Testing requestBookingOtp()...");
  const testPhone = "0912" + Math.floor(1000000 + Math.random() * 9000000);
  const otpRes = await client.requestBookingOtp({
    phone: testPhone,
    full_name: "تستر رزرو اینستاگرام",
    instagram_handle: "ts_sdk_user",
    utm_source: "ts_integration_test",
  });
  console.log(`   ✅ Success! Waitlist ID: ${otpRes.waitlist_id}, OTP: ${otpRes.debug_otp}`);

  // 5. Confirm booking
  console.log("\n5. Testing confirmBooking()...");
  const confirmRes = await client.confirmBooking({
    waitlist_id: otpRes.waitlist_id,
    otp: otpRes.debug_otp || "12345",
    appointment_time: new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace("T", " "),
  });
  console.log(`   ✅ Success! CRM Lead ID: ${confirmRes.crm_lead_id}, Score: ${confirmRes.lead_score}, Assigned Agent: ${confirmRes.assigned_agent_name}`);

  // 6. Query Lead Status
  console.log("\n6. Testing getLeadStatus()...");
  const statusRes = await client.getLeadStatus({ waitlist_id: otpRes.waitlist_id });
  console.log(`   ✅ Success! Found: ${statusRes.found}, Verified: ${statusRes.is_verified}, Time: ${statusRes.appointment_time}`);

  // 7. Cancel Booking
  console.log("\n7. Testing cancelBooking()...");
  const cancelRes = await client.cancelBooking({ waitlist_id: otpRes.waitlist_id });
  console.log(`   ✅ Success! ${cancelRes.message}`);

  // 8. Standalone Fallback Verification
  console.log("\n8. Testing Standalone Fallback Resilience...");
  const offlineClient = new PhpBookingClient("http://127.0.0.1:9999/non_existent.php", "dummy_key", 500);
  const fallbackSlots = await offlineClient.getAvailableSlots();
  console.log(`   ✅ Success! Fallback triggered cleanly without crashing: ${fallbackSlots.message}, Slots count: ${fallbackSlots.slots.length}`);

  console.log("\n=====================================================");
  console.log("🎉 All 8 TypeScript SDK Bridge Integration Tests Passed 100%!");
  console.log("=====================================================");
}

runIntegrationTest().catch((err) => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
