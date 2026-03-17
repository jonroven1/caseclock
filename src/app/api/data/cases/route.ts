/**
 * GET /api/data/cases - List cases
 * POST /api/data/cases - Create/import case
 * Requires X-User-Id header or userId query (authenticated user)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api";
import { getCases, saveCase } from "@/lib/data-store";
import {
  buildCaseFromImport,
  generateCaseId,
  validateCaseImportInput,
} from "@/lib/case-import";
import type { Case, CaseImportInput } from "@/types";

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cases = await getCases(userId);
  return NextResponse.json(cases);
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CaseImportInput;
    const validated = validateCaseImportInput(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const caseData = buildCaseFromImport(userId, body);
    const id = generateCaseId();
    const newCase: Case = { id, ...caseData };

    await saveCase(newCase);

    return NextResponse.json({ success: true, case: newCase });
  } catch (err) {
    console.error("Create case error:", err);
    return NextResponse.json(
      { error: "Failed to create case" },
      { status: 500 }
    );
  }
}
