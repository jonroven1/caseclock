/**
 * Shared logic for case import (single and bulk)
 */

import type { Case, CaseImportInput } from "@/types";

export function generateCaseId(): string {
  return String(1000000 + Math.floor(Math.random() * 9000000));
}

export function buildCaseFromImport(
  userId: string,
  input: CaseImportInput
): Omit<Case, "id"> {
  const clientName = `${input.clientFirstName} ${input.clientLastName}`.trim();
  const defendant =
    input.defendantName ??
    `${input.defendantFirstName ?? ""} ${input.defendantLastName ?? ""}`.trim();
  const caseName = defendant
    ? `${clientName} v. ${defendant}`
    : clientName;

  return {
    userId,
    caseName,
    matterNumber: input.caseNumber,
    clientName,
    clientFirstName: input.clientFirstName,
    clientLastName: input.clientLastName,
    defendantName: input.defendantName,
    defendantFirstName: input.defendantFirstName,
    defendantLastName: input.defendantLastName,
    caseNumber: input.caseNumber,
    caseId: input.caseId,
    defenseCounsel: input.defenseCounsel,
    emails: (input.emails ?? []).filter(Boolean).slice(0, 6),
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export function validateCaseImportInput(
  body: CaseImportInput
): { ok: true } | { ok: false; error: string } {
  const {
    clientFirstName,
    clientLastName,
    caseNumber,
    defendantName,
    defendantFirstName,
    defendantLastName,
  } = body;

  if (!clientFirstName?.trim() || !clientLastName?.trim() || !caseNumber?.trim()) {
    return {
      ok: false,
      error: "clientFirstName, clientLastName, and caseNumber are required",
    };
  }

  const defendantProvided =
    defendantName?.trim() ||
    (defendantFirstName?.trim() && defendantLastName?.trim());
  if (!defendantProvided) {
    return {
      ok: false,
      error:
        "Provide either defendantName (entity) or defendantFirstName + defendantLastName (individual)",
    };
  }

  return { ok: true };
}
