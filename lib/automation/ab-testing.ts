/**
 * OpenReply A/B Testing Message Variation Selector
 * Allows marketing campaigns to define multiple DM text variations separated by `\n---\n`.
 * OpenReply automatically selects a variation per message to optimize offer conversion rates.
 */

export function selectDmMessageVariation(dmMessage: string | null | undefined): string {
  if (!dmMessage) return "";

  // If DM text contains `\n---\n`, split and pick a random variation for A/B testing
  if (dmMessage.includes("\n---\n")) {
    const variations = dmMessage
      .split("\n---\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (variations.length > 0) {
      const selectedIndex = Math.floor(Math.random() * variations.length);
      return variations[selectedIndex];
    }
  }

  return dmMessage;
}
