import type { KnowledgeType, KnowledgeStatus } from "@/generated/prisma/client";

export const KNOWLEDGE_TYPES: KnowledgeType[] = [
  "COMPANY_FACT",
  "AUDIENCE",
  "VOICE_RULE",
  "POSITIONING",
  "APPROVED_TERM",
  "PROHIBITED_TERM",
  "APPROVED_CLAIM",
  "PROHIBITED_CLAIM",
  "OFFER",
  "STANDING_INSTRUCTION",
  "SOURCE_DOCUMENT",
];

export const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  COMPANY_FACT: "Company fact",
  AUDIENCE: "Audience",
  VOICE_RULE: "Voice rule",
  POSITIONING: "Positioning",
  APPROVED_TERM: "Approved term",
  PROHIBITED_TERM: "Prohibited term",
  APPROVED_CLAIM: "Approved claim",
  PROHIBITED_CLAIM: "Prohibited claim",
  OFFER: "Offer",
  STANDING_INSTRUCTION: "Standing instruction",
  SOURCE_DOCUMENT: "Source document",
};

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeStatus, string> = {
  PROPOSED: "Proposed",
  APPROVED: "Approved",
  DEPRECATED: "Deprecated",
};

// Records whose content generation should actively avoid — used both to
// build the "never use" section of the generation prompt and as the check
// list for the post-generation compliance pass.
export const PROHIBITIVE_TYPES: KnowledgeType[] = [
  "PROHIBITED_TERM",
  "PROHIBITED_CLAIM",
];
