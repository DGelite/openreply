import { describe, it, expect } from "vitest";
import { extractPhoneNumber } from "@/lib/ai/phone-extractor";

describe("100 Conversational Iranian Phone Number Extraction Scenarios", () => {
  // ── Category 1: Pure Iranian Mobile Numbers in Various Numeral Scripts (1-15) ──
  it("01: Standard English digits (09123456789)", () => {
    const res = extractPhoneNumber({ messageText: "09123456789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("02: Standard Persian digits (۰۹۱۲۳۴۵۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "۰۹۱۲۳۴۵۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("03: Standard Arabic digits (٠٩١٢٣٤٥٦٧٨٩)", () => {
    const res = extractPhoneNumber({ messageText: "٠٩١٢٣٤٥٦٧٨٩" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("04: Mixed Persian and English digits (0912۳۴۵۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "0912۳۴۵۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("05: Mixed Arabic and English digits (0912٣٤٥٦٧٨٩)", () => {
    const res = extractPhoneNumber({ messageText: "0912٣٤٥٦٧٨٩" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("06: Mixed Persian and Arabic digits (۰۹۱۲٣٤٥۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "۰۹۱۲٣٤٥۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("07: Without leading zero English (9123456789)", () => {
    const res = extractPhoneNumber({ messageText: "9123456789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("08: Without leading zero Persian (۹۱۲۳۴۵۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "۹۱۲۳۴۵۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("09: Without leading zero Arabic (٩١٢٣٤٥٦٧٨٩)", () => {
    const res = extractPhoneNumber({ messageText: "٩١٢٣٤٥٦٧٨٩" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("10: +98 format English (+989123456789)", () => {
    const res = extractPhoneNumber({ messageText: "+989123456789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("11: +98 format Persian (+۹۸۹۱۲۳۴۵۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "+۹۸۹۱۲۳۴۵۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("12: 0098 format English (00989123456789)", () => {
    const res = extractPhoneNumber({ messageText: "00989123456789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("13: 0098 format Persian (۰۰۹۸۹۱۲۳۴۵۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "۰۰۹۸۹۱۲۳۴۵۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("14: 98 format English without prefix (989123456789)", () => {
    const res = extractPhoneNumber({ messageText: "989123456789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("15: 98 format Persian without prefix (۹۸۹۱۲۳۴۵۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "۹۸۹۱۲۳۴۵۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  // ── Category 2: Formatting Separators (16-30) ──
  it("16: Space separated 4-3-4 (0912 345 6789)", () => {
    const res = extractPhoneNumber({ messageText: "0912 345 6789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("17: Space separated 4-7 (0912 3456789)", () => {
    const res = extractPhoneNumber({ messageText: "0912 3456789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("18: Space separated Persian (۰۹۱۲ ۳۴۵ ۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "۰۹۱۲ ۳۴۵ ۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("19: Multiple irregular spaces (0912   345   6789)", () => {
    const res = extractPhoneNumber({ messageText: "0912   345   6789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("20: Dash separated (0912-345-6789)", () => {
    const res = extractPhoneNumber({ messageText: "0912-345-6789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("21: Dash separated Persian (۰۹۱۲-۳۴۵-۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "۰۹۱۲-۳۴۵-۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("22: Dot separated (0912.345.6789)", () => {
    const res = extractPhoneNumber({ messageText: "0912.345.6789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("23: Dot separated Persian (۰۹۱۲.۳۴۵.۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "۰۹۱۲.۳۴۵.۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("24: Slash separated (0912/345/6789)", () => {
    const res = extractPhoneNumber({ messageText: "0912/345/6789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("25: Slash separated Persian (۰۹۱۲/۳۴۵/۶۷۸۹)", () => {
    const res = extractPhoneNumber({ messageText: "۰۹۱۲/۳۴۵/۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("26: Underscore separated (0912_345_6789)", () => {
    const res = extractPhoneNumber({ messageText: "0912_345_6789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("27: Parentheses code ((0912) 3456789)", () => {
    const res = extractPhoneNumber({ messageText: "(0912) 3456789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("28: Parentheses with dash ((0912)-345-6789)", () => {
    const res = extractPhoneNumber({ messageText: "(0912)-345-6789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("29: International spaced (+98 912 345 6789)", () => {
    const res = extractPhoneNumber({ messageText: "+98 912 345 6789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("30: International dashed (+98-912-345-6789)", () => {
    const res = extractPhoneNumber({ messageText: "+98-912-345-6789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  // ── Category 3: Conversational Sentences & Slang / Polite Phrases (31-50) ──
  it("31: شماره من 09123456789 هست", () => {
    const res = extractPhoneNumber({ messageText: "شماره من 09123456789 هست" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("32: شمارم ۰۹۱۲۳۴۵۶۷۸۹ هست زنگ بزنید", () => {
    const res = extractPhoneNumber({ messageText: "شمارم ۰۹۱۲۳۴۵۶۷۸۹ هست زنگ بزنید" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("33: سلام، شماره تماس من ۰۹۳۵۱۱۱۱۱۱۱", () => {
    const res = extractPhoneNumber({ messageText: "سلام، شماره تماس من ۰۹۳۵۱۱۱۱۱۱۱" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09351111111");
  });

  it("34: سلام وقتتون بخیر شماره موبایلم: 09191234567", () => {
    const res = extractPhoneNumber({ messageText: "سلام وقتتون بخیر شماره موبایلم: 09191234567" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09191234567");
  });

  it("35: درود شماره جهت هماهنگی ۰۹۱۲۳۴۵۶۷۸۹ ممنون", () => {
    const res = extractPhoneNumber({ messageText: "درود شماره جهت هماهنگی ۰۹۱۲۳۴۵۶۷۸۹ ممنون" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("36: این شماره منه ۰۹۱۸۱۲۳۴۵۶۷ تماس بگیرید", () => {
    const res = extractPhoneNumber({ messageText: "این شماره منه ۰۹۱۸۱۲۳۴۵۶۷ تماس بگیرید" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09181234567");
  });

  it("37: سلام لطفا با 09301234567 هماهنگ بشید", () => {
    const res = extractPhoneNumber({ messageText: "سلام لطفا با 09301234567 هماهنگ بشید" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09301234567");
  });

  it("38: سلام برای دوره میخوام ثبت نام کنم شماره ۰۹۱۲۳۴۵۶۷۸۹", () => {
    const res = extractPhoneNumber({ messageText: "سلام برای دوره میخوام ثبت نام کنم شماره ۰۹۱۲۳۴۵۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("39: شماره تماسم خدمت شما ۰۹۳۶۱۱۱۲۲۳۳", () => {
    const res = extractPhoneNumber({ messageText: "شماره تماسم خدمت شما ۰۹۳۶۱۱۱۲۲۳۳" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09361112233");
  });

  it("40: بفرمایید اینم شماره: 09121234567", () => {
    const res = extractPhoneNumber({ messageText: "بفرمایید اینم شماره: 09121234567" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09121234567");
  });

  it("41: سلام اینم شمارم 0912 123 4567", () => {
    const res = extractPhoneNumber({ messageText: "سلام اینم شمارم 0912 123 4567" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09121234567");
  });

  it("42: سلام روز خوش شماره: +989123456789", () => {
    const res = extractPhoneNumber({ messageText: "سلام روز خوش شماره: +989123456789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("43: ۰۹۱۲۳۴۵۶۷۸۹ بفرمایید منتظر تماستون هستم", () => {
    const res = extractPhoneNumber({ messageText: "۰۹۱۲۳۴۵۶۷۸۹ بفرمایید منتظر تماستون هستم" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("44: با شماره ۰۹۱۱۱۲۳۴۵۶۷ تماس حاصل فرمایید", () => {
    const res = extractPhoneNumber({ messageText: "با شماره ۰۹۱۱۱۲۳۴۵۶۷ تماس حاصل فرمایید" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09111234567");
  });

  it("45: لطفاً عصر زنگ بزنید 09123456789", () => {
    const res = extractPhoneNumber({ messageText: "لطفاً عصر زنگ بزنید 09123456789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("46: من کارمند هستم بعد از ظهر با ۰۹۱۲۳۴۵۶۷۸۹ تماس بگیرید", () => {
    const res = extractPhoneNumber({ messageText: "من کارمند هستم بعد از ظهر با ۰۹۱۲۳۴۵۶۷۸۹ تماس بگیرید" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("47: شمارم اینه عزیزم 09351234567", () => {
    const res = extractPhoneNumber({ messageText: "شمارم اینه عزیزم 09351234567" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09351234567");
  });

  it("48: شماره موبایل من: 0912-345-6789 است", () => {
    const res = extractPhoneNumber({ messageText: "شماره موبایل من: 0912-345-6789 است" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("49: سلام وقت بخیر ۰۹۱۹۱۲۳۴۵۶۷", () => {
    const res = extractPhoneNumber({ messageText: "سلام وقت بخیر ۰۹۱۹۱۲۳۴۵۶۷" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09191234567");
  });

  it("50: خسته نباشید 09391234567", () => {
    const res = extractPhoneNumber({ messageText: "خسته نباشید 09391234567" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09391234567");
  });

  // ── Category 4: Multi-Operator Codes (51-65) ──
  it("51: MCI Hamrah-e Aval 0912", () => {
    const res = extractPhoneNumber({ messageText: "09121112233" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09121112233");
  });

  it("52: MCI Hamrah-e Aval 0919", () => {
    const res = extractPhoneNumber({ messageText: "09192223344" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09192223344");
  });

  it("53: MCI Hamrah-e Aval 0910", () => {
    const res = extractPhoneNumber({ messageText: "09103334455" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09103334455");
  });

  it("54: MCI Hamrah-e Aval 0911 (North)", () => {
    const res = extractPhoneNumber({ messageText: "09114445566" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09114445566");
  });

  it("55: MCI Hamrah-e Aval 0913 (Isfahan)", () => {
    const res = extractPhoneNumber({ messageText: "09135556677" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09135556677");
  });

  it("56: MCI Hamrah-e Aval 0914 (Azarbaijan)", () => {
    const res = extractPhoneNumber({ messageText: "09146667788" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09146667788");
  });

  it("57: MCI Hamrah-e Aval 0915 (Khorasan)", () => {
    const res = extractPhoneNumber({ messageText: "09157778899" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09157778899");
  });

  it("58: MCI Hamrah-e Aval 0916 (Khuzestan)", () => {
    const res = extractPhoneNumber({ messageText: "09168889900" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09168889900");
  });

  it("59: MCI Hamrah-e Aval 0917 (Fars)", () => {
    const res = extractPhoneNumber({ messageText: "09179990011" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09179990011");
  });

  it("60: MCI Hamrah-e Aval 0918 (West)", () => {
    const res = extractPhoneNumber({ messageText: "09181110022" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09181110022");
  });

  it("61: Irancell 0935", () => {
    const res = extractPhoneNumber({ messageText: "09351112233" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09351112233");
  });

  it("62: Irancell 0936", () => {
    const res = extractPhoneNumber({ messageText: "09362223344" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09362223344");
  });

  it("63: Irancell 0930", () => {
    const res = extractPhoneNumber({ messageText: "09303334455" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09303334455");
  });

  it("64: Irancell 0902", () => {
    const res = extractPhoneNumber({ messageText: "09024445566" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09024445566");
  });

  it("65: RighTel 0921", () => {
    const res = extractPhoneNumber({ messageText: "09215556677" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09215556677");
  });

  // ── Category 5: Third-Party & Family Numbers (66-75) ──
  it("66: شماره همسرم خانم حسینی: ۰۹۱۲۳۴۵۶۷۸۹", () => {
    const res = extractPhoneNumber({ messageText: "شماره همسرم خانم حسینی: ۰۹۱۲۳۴۵۶۷۸۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
    expect(res.owner).toBe("THIRD_PARTY");
  });

  it("67: با آقای کریمی هماهنگ کنید شمارشون 09121112233", () => {
    const res = extractPhoneNumber({ messageText: "با آقای کریمی هماهنگ کنید شمارشون 09121112233" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09121112233");
    expect(res.owner).toBe("THIRD_PARTY");
  });

  it("68: شماره پدرم هست باهاشون صحبت کنید: ۰۹۱۳۱۱۱۴۴۵۵", () => {
    const res = extractPhoneNumber({ messageText: "شماره پدرم هست باهاشون صحبت کنید: ۰۹۱۳۱۱۱۴۴۵۵" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09131114455");
    expect(res.owner).toBe("THIRD_PARTY");
  });

  it("69: شماره دوستم آقای رضایی 09352223344", () => {
    const res = extractPhoneNumber({ messageText: "شماره دوستم آقای رضایی 09352223344" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09352223344");
    expect(res.owner).toBe("THIRD_PARTY");
  });

  it("70: شماره برادرمه ۰۹۱۵۱۲۳۴۵۶۷", () => {
    const res = extractPhoneNumber({ messageText: "شماره برادرمه ۰۹۱۵۱۲۳۴۵۶۷" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09151234567");
    expect(res.owner).toBe("THIRD_PARTY");
  });

  it("71: این شماره مادرمه لطفا زنگ بزنید ۰۹۱۴۱۲۳۴۵۶۷", () => {
    const res = extractPhoneNumber({ messageText: "این شماره مادرمه لطفا زنگ بزنید ۰۹۱۴۱۲۳۴۵۶۷" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09141234567");
    expect(res.owner).toBe("THIRD_PARTY");
  });

  it("72: مدیرعاملمون آقای دکتر صادقی: 09128889900", () => {
    const res = extractPhoneNumber({ messageText: "مدیرعاملمون آقای دکتر صادقی: 09128889900" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09128889900");
    expect(res.owner).toBe("THIRD_PARTY");
  });

  it("73: شماره همکارم خانم راد ۰۹۱۹۲۲۲۳۳۴۴", () => {
    const res = extractPhoneNumber({ messageText: "شماره همکارم خانم راد ۰۹۱۹۲۲۲۳۳۴۴" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09192223344");
    expect(res.owner).toBe("THIRD_PARTY");
  });

  it("74: این شماره خانم احمدی هست: 09304445566", () => {
    const res = extractPhoneNumber({ messageText: "این شماره خانم احمدی هست: 09304445566" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09304445566");
    expect(res.owner).toBe("THIRD_PARTY");
  });

  it("75: با خواهرم هماهنگ کنید ۰۹۲۱۲۲۲۳۳۴۴", () => {
    const res = extractPhoneNumber({ messageText: "با خواهرم هماهنگ کنید ۰۹۲۱۲۲۲۳۳۴۴" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09212223344");
    expect(res.owner).toBe("THIRD_PARTY");
  });

  // ── Category 6: Corrections & Updates (76-85) ──
  it("76: ببخشید دستم خورد شماره قبلی اشتباه شد این درسته: 09123456789", () => {
    const res = extractPhoneNumber({ messageText: "ببخشید دستم خورد شماره قبلی اشتباه شد این درسته: 09123456789" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
    expect(res.isCorrection).toBe(true);
  });

  it("77: اشتباه شد، شمارم اینه: ۰۹۱۹۱۱۱۲۲۳۳", () => {
    const res = extractPhoneNumber({ messageText: "اشتباه شد، شمارم اینه: ۰۹۱۹۱۱۱۲۲۳۳" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09191112233");
    expect(res.isCorrection).toBe(true);
  });

  it("78: شماره قبلی خاموشه با این تماس بگیرید: ۰۹۳۵۴۴۴۵۵۶۶", () => {
    const res = extractPhoneNumber({ messageText: "شماره قبلی خاموشه با این تماس بگیرید: ۰۹۳۵۴۴۴۵۵۶۶" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09354445566");
  });

  it("79: شماره درست اینه 09123334455", () => {
    const res = extractPhoneNumber({ messageText: "شماره درست اینه 09123334455" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123334455");
    expect(res.isCorrection).toBe(true);
  });

  it("80: غلط نوشتم، شماره اصلی اینه: ۰۹۱۲۷۷۷۸۸۹۹", () => {
    const res = extractPhoneNumber({ messageText: "غلط نوشتم، شماره اصلی اینه: ۰۹۱۲۷۷۷۸۸۹۹" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09127778899");
    expect(res.isCorrection).toBe(true);
  });

  it("81: اصلاح میکنم شماره من 09101112233 هست", () => {
    const res = extractPhoneNumber({ messageText: "اصلاح میکنم شماره من 09101112233 هست" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09101112233");
    expect(res.isCorrection).toBe(true);
  });

  it("82: سلام نه شماره قبلی اشتباه بود این درسته ۰۹۱۸۲۲۲۳۳۴۴", () => {
    const res = extractPhoneNumber({ messageText: "سلام نه شماره قبلی اشتباه بود این درسته ۰۹۱۸۲۲۲۳۳۴۴" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09182223344");
    expect(res.isCorrection).toBe(true);
  });

  it("83: شمارمو اشتباه زدم درستش ۰۹۱۴۴۴۴۵۵۶۶", () => {
    const res = extractPhoneNumber({ messageText: "شمارمو اشتباه زدم درستش ۰۹۱۴۴۴۴۵۵۶۶" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09144445566");
  });

  it("84: ببخشید اون خطم قطع شده این یکی خطمه 09125556677", () => {
    const res = extractPhoneNumber({ messageText: "ببخشید اون خطم قطع شده این یکی خطمه 09125556677" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09125556677");
  });

  it("85: شماره جدید من: ۰۹۳۹۹۹۹۸۸۷۷", () => {
    const res = extractPhoneNumber({ messageText: "شماره جدید من: ۰۹۳۹۹۹۹۸۸۷۷" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09399998877");
  });

  // ── Category 7: Spoken Word Numbers in Persian (86-92) ──
  it("86: صفر نهصد و دوازده سیصد و چهل و پنج شصت و هفت هشتاد و نه", () => {
    const res = extractPhoneNumber({ messageText: "صفر نهصد و دوازده سیصد و چهل و پنج شصت و هفت هشتاد و نه" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("87: صفر نهصد و نوزده دویست و بیست سی و سه چهل و چهار", () => {
    const res = extractPhoneNumber({ messageText: "صفر نهصد و نوزده دویست و بیست سی و سه چهل و چهار" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09192203344");
  });

  it("88: نهصد و دوازده چهارصد و چهل و چهار پنجاه و پنج شصت و شش", () => {
    const res = extractPhoneNumber({ messageText: "نهصد و دوازده چهارصد و چهل و چهار پنجاه و پنج شصت و شش" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09124445566");
  });

  it("89: صفر نهصد و سی و پنج یکصد و یازده بیست و دو سی و سه", () => {
    const res = extractPhoneNumber({ messageText: "صفر نهصد و سی و پنج یکصد و یازده بیست و دو سی و سه" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09351112233");
  });

  it("90: نهصد و سی و شش هفتصد و هشتاد و نه ده بیست", () => {
    const res = extractPhoneNumber({ messageText: "نهصد و سی و شش هفتصد و هشتاد و نه ده بیست" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09367891020");
  });

  it("91: صفر نهصد و بیست و یک پانصد و پنجاه و پنج شصت و شش هفتاد و هفت", () => {
    const res = extractPhoneNumber({ messageText: "صفر نهصد و بیست و یک پانصد و پنجاه و پنج شصت و شش هفتاد و هفت" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09215556677");
  });

  it("92: 0912 دویست و بیست و دو سی و سه چهل و چهار", () => {
    const res = extractPhoneNumber({ messageText: "0912 دویست و بیست و دو سی و سه چهل و چهار" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09122223344");
  });

  // ── Category 8: Multi-Message Buffer Assembly (93-96) ──
  it("93: Buffer '0912' + Message '3456789' -> 09123456789", () => {
    const res = extractPhoneNumber({
      messageText: "3456789",
      previousBuffer: "0912",
      bufferAgeMs: 30000,
    });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  it("94: Buffer '۰۹۱۹' + Message '۲۲۲۳۳۴۴' -> 09192223344", () => {
    const res = extractPhoneNumber({
      messageText: "۲۲۲۳۳۴۴",
      previousBuffer: "0919",
      bufferAgeMs: 20000,
    });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09192223344");
  });

  it("95: Buffer '0935' + Message '111 2233' -> 09351112233", () => {
    const res = extractPhoneNumber({
      messageText: "111 2233",
      previousBuffer: "0935",
      bufferAgeMs: 45000,
    });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09351112233");
  });

  it("96: Buffer '۰۹۱۲۳۴۵' + Message '۶۷۸۹' -> 09123456789", () => {
    const res = extractPhoneNumber({
      messageText: "۶۷۸۹",
      previousBuffer: "0912345",
      bufferAgeMs: 10000,
    });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("09123456789");
  });

  // ── Category 9: International Dialing Formats for Expats (97-100) ──
  it("97: US phone number (+14155552671)", () => {
    const res = extractPhoneNumber({ messageText: "+14155552671" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("+14155552671");
  });

  it("98: UK phone number (+447911123456)", () => {
    const res = extractPhoneNumber({ messageText: "+447911123456" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("+447911123456");
  });

  it("99: UAE / Dubai phone number (+971501234567)", () => {
    const res = extractPhoneNumber({ messageText: "+971501234567" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("+971501234567");
  });

  it("100: Turkey phone number (+905321234567)", () => {
    const res = extractPhoneNumber({ messageText: "+905321234567" });
    expect(res.detected).toBe(true);
    expect(res.phoneNumber).toBe("+905321234567");
  });

  // ── Negative Tests: Ensuring Zero False Positives ──
  it("Negative 01: Bank Card Number (16 digits) must NOT be detected as phone", () => {
    const res = extractPhoneNumber({ messageText: "شماره کارت 6037991812345678" });
    expect(res.detected).toBe(false);
  });

  it("Negative 02: Price with Toman must NOT be detected as phone", () => {
    const res = extractPhoneNumber({ messageText: "قیمت دوره ۵۰۰ هزار تومان است" });
    expect(res.detected).toBe(false);
  });

  it("Negative 03: Postal tracking code (24 digits) must NOT be detected as phone", () => {
    const res = extractPhoneNumber({ messageText: "کد رهگیری پستی: 123456789012345678901234" });
    expect(res.detected).toBe(false);
  });

  it("Negative 04: Iranian National ID (10 digits starting with 00) must NOT be detected as phone", () => {
    const res = extractPhoneNumber({ messageText: "کد ملی: 0012345678" });
    expect(res.detected).toBe(false);
  });

  it("Negative 05: Intent to provide phone later", () => {
    const res = extractPhoneNumber({ messageText: "الان شماره می‌فرستم" });
    expect(res.detected).toBe(false);
    expect(res.intent).toBe("INTENDING_TO_PROVIDE");
  });
});
