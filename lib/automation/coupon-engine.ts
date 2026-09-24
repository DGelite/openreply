import { prisma } from "@/lib/db/client";

export interface CouponClaimResult {
  success: boolean;
  code: string | null;
  alreadyClaimed: boolean;
  message: string;
}

/**
 * Claims a coupon code for a user from a coupon pool.
 */
export async function claimCoupon(params: {
  poolId: string;
  userId: string; // IGSID
}): Promise<CouponClaimResult> {
  const { poolId, userId } = params;

  const pool = await prisma.couponPool.findUnique({
    where: { id: poolId },
    include: {
      codes: true,
    },
  });

  if (!pool) {
    return {
      success: false,
      code: null,
      alreadyClaimed: false,
      message: "استخر کد تخفیف یافت نشد.",
    };
  }

  // Check if user has already claimed a code from this pool
  const existingClaim = pool.codes.find((c) => c.claimedByUserId === userId);
  if (existingClaim) {
    return {
      success: true,
      code: existingClaim.code,
      alreadyClaimed: true,
      message: `کد تخفیف شما قبلاً صادر شده است: ${existingClaim.code}`,
    };
  }

  if (pool.isUniqueCodes) {
    // Find an available unclaimed unique code
    const availableCode = await prisma.couponCode.findFirst({
      where: {
        poolId,
        isClaimed: false,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!availableCode) {
      return {
        success: false,
        code: null,
        alreadyClaimed: false,
        message: "متأسفانه کدهای تخفیف اختصاصی به پایان رسیده است.",
      };
    }

    // Atomically mark code as claimed
    const claimedCode = await prisma.couponCode.update({
      where: { id: availableCode.id },
      data: {
        isClaimed: true,
        claimedByUserId: userId,
        claimedAt: new Date(),
      },
    });

    return {
      success: true,
      code: claimedCode.code,
      alreadyClaimed: false,
      message: `کد تخفیف اختصاصی شما: ${claimedCode.code} 🎁`,
    };
  } else {
    // Generic single code pool
    const code = pool.defaultCode || "OFFER100";
    return {
      success: true,
      code,
      alreadyClaimed: false,
      message: `کد تخفیف شما: ${code} 🎁`,
    };
  }
}
