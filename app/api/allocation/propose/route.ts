/**
 * GET /api/allocation/propose?variantId=<id>
 *
 * Compute an allocation proposal for a product variant.
 * Returns scored stores with suggested quantities.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeAllocationProposal } from "@/server/services/allocation.service";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const variantId = req.nextUrl.searchParams.get("variantId");
  if (!variantId) {
    return NextResponse.json({ error: "variantId is required" }, { status: 400 });
  }

  try {
    const proposal = await computeAllocationProposal(variantId);
    return NextResponse.json(proposal);
  } catch (err) {
    console.error("[allocation/propose]", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
