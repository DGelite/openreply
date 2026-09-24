import { smsManagerService } from "../lib/services/sms-manager-service";

async function runSmsIntegrationTest() {
  console.log("=====================================================");
  console.log("🧪 OpenReply <-> sms.ir Gateway Integration Test");
  console.log("=====================================================\n");

  try {
    // 1. Test Credit Fetch (Hybrid Mode)
    console.log("1. Querying SMS Credit Balance (Hybrid Mode)...");
    const creditRes = await smsManagerService.getCredit("HYBRID");
    console.log(`   ✅ Success! Source: ${creditRes.source}`);
    console.log(`      Balance: ${creditRes.credit.toLocaleString()} ${creditRes.currency}\n`);

    // 2. Test SMS Dispatch via PHP Proxy
    console.log("2. Testing SMS Dispatch via PHP Reservation Proxy...");
    const proxySendRes = await smsManagerService.sendSms({
      mode: "PHP_PROXY",
      type: "pattern",
      receptor: "09121111111",
      templateId: "100000",
      parameters: [{ name: "Code", value: "998877" }],
    });
    console.log("   ✅ Success! PHP Proxy Response:", JSON.stringify(proxySendRes, null, 2));

    console.log("\n=====================================================");
    console.log("🎉 SMS Integration Test Completed 100%!");
    console.log("=====================================================");
  } catch (error) {
    console.error("❌ Test Failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runSmsIntegrationTest();
