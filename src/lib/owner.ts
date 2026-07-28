// Single-owner app — there is exactly one operator, so "who is this action
// attributed to" comes from trusted local configuration, never from an MCP
// caller's own say-so. A conversational AI client must not supply or guess
// this value.
export function getOwnerName(): string {
  return process.env.NOTICED_OWNER_NAME?.trim() || "Owner";
}
