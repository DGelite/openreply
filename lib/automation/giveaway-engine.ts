import { prisma } from "@/lib/db/client";
import { randomInt } from "crypto";

export interface GiveawayEntryResult {
  success: boolean;
  ticketNumber?: number;
  alreadyEntered: boolean;
  message: string;
}

/**
 * Registers a participant in a giveaway campaign.
 */
export async function registerGiveawayEntry(params: {
  giveawayId: string;
  userId: string; // IGSID
  username?: string;
  entryTrigger: "COMMENT" | "DM" | "STORY";
}): Promise<GiveawayEntryResult> {
  const { giveawayId, userId, username, entryTrigger } = params;

  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: {
      participants: {
        where: { userId },
      },
    },
  });

  if (!giveaway || giveaway.status !== "ACTIVE") {
    return {
      success: false,
      alreadyEntered: false,
      message: "مسابقه غیرفعال است یا یافت نشد.",
    };
  }

  if (giveaway.participants.length >= giveaway.maxTicketsPerUser) {
    const existingTicket = giveaway.participants[0]?.ticketNumber;
    return {
      success: true,
      alreadyEntered: true,
      ticketNumber: existingTicket,
      message: `شما قبلاً در این مسابقه شرکت کرده‌اید. شماره شانس شما: ${existingTicket}`,
    };
  }

  const nextTicketNumber = giveaway.totalEntries + 1;

  const participant = await prisma.giveawayParticipant.create({
    data: {
      giveawayId,
      userId,
      username,
      ticketNumber: nextTicketNumber,
      entryTrigger,
    },
  });

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: {
      totalEntries: { increment: 1 },
    },
  });

  return {
    success: true,
    alreadyEntered: false,
    ticketNumber: participant.ticketNumber,
    message: `شرکت شما در مسابقه با موفقیت ثبت شد! 🎟️ شماره شانس شما: ${participant.ticketNumber}`,
  };
}

export interface GiveawayWinnerResult {
  winnerId: string;
  userId: string;
  username: string | null;
  ticketNumber: number;
  winningRank: number;
}

/**
 * Performs a cryptographically secure random winner draw for a giveaway.
 */
export async function drawGiveawayWinners(
  giveawayId: string,
  winnerCount: number = 1
): Promise<GiveawayWinnerResult[]> {
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: {
      participants: true,
    },
  });

  if (!giveaway || giveaway.participants.length === 0) {
    throw new Error("شرکت‌کننده‌ای برای قرعه‌کشی وجود ندارد.");
  }

  const pool = [...giveaway.participants];
  const winners: GiveawayWinnerResult[] = [];
  const actualWinnerCount = Math.min(winnerCount, pool.length);

  for (let rank = 1; rank <= actualWinnerCount; rank++) {
    // Cryptographically secure random index selection
    const randomIndex = randomInt(0, pool.length);
    const selectedParticipant = pool.splice(randomIndex, 1)[0];

    const winnerRecord = await prisma.giveawayWinner.create({
      data: {
        giveawayId,
        participantId: selectedParticipant.id,
        userId: selectedParticipant.userId,
        username: selectedParticipant.username,
        ticketNumber: selectedParticipant.ticketNumber,
        winningRank: rank,
      },
    });

    winners.push({
      winnerId: winnerRecord.id,
      userId: selectedParticipant.userId,
      username: selectedParticipant.username,
      ticketNumber: selectedParticipant.ticketNumber,
      winningRank: rank,
    });
  }

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: {
      status: "DRAWN",
      drawnAt: new Date(),
    },
  });

  return winners;
}
