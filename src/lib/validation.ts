const PROHIBITED_PHRASES = [
  "guarantees compliance",
  "guaranteed compliance",
  "replaces legal counsel",
  "litigation-ready",
  "ai-powered",
  "revolutionary",
  "game-changing",
];

export type ValidationIssue = {
  rule: string;
  quote: string;
  severity: "BLOCKING" | "WARNING";
};

/** Deterministic checks only. No model call and no claim of editorial judgment. */
export function validateWritingDraft(body: string): ValidationIssue[] {
  const normalized = body.toLowerCase();
  const issues: ValidationIssue[] = [];
  for (const phrase of PROHIBITED_PHRASES) {
    if (normalized.includes(phrase)) {
      issues.push({ rule: "Prohibited claim or positioning", quote: phrase, severity: "BLOCKING" });
    }
  }
  if (body.trim().length < 80) {
    issues.push({ rule: "Draft is too short for destination review", quote: `${body.trim().length} characters`, severity: "WARNING" });
  }
  return issues;
}
