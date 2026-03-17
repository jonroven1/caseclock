/**
 * POST /api/data/cases/import - Bulk import cases from JSON
 * Body: { cases: CaseImportInput[] }
 * Requires X-User-Id header or userId query
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api";
import { saveCase } from "@/lib/data-store";
import {
  buildCaseFromImport,
  generateCaseId,
  validateCaseImportInput,
} from "@/lib/case-import";
import type { Case, CaseImportInput } from "@/types";

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { cases: CaseImportInput[] };
    const cases = body.cases;
    if (!Array.isArray(cases) || cases.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a non-empty 'cases' array" },
        { status: 400 }
      );
    }

    const created: Case[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < cases.length; i++) {
      const input = cases[i];
      const validated = validateCaseImportInput(input);
      if (!validated.ok) {
        errors.push({ index: i + 1, error: validated.error });
        continue;
      } else {
        const caseData = buildCaseFromImport(userId, input);
        const id = generateCaseId();
        const newCase: Case = { id, ...caseData };
        await saveCase(newCase);
        created.push(newCase);
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      failed: errors.length,
      cases: created,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Bulk import error:", err);
    return NextResponse.json(
      { error: "Failed to import cases" },
      { status: 500 }
    );
  }
}
