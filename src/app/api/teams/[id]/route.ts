/**
 * GET /api/teams/[id] — Get a specific team
 * POST /api/teams/[id] — Update a team
 * DELETE /api/teams/[id] — Delete a team
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { teams, teamMemberships, users } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
    }

    // Get team with members
    const [team] = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        organizationId: teams.organizationId,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
      })
      .from(teams)
      .where(eq(teams.id, id));

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get team members
    const members = await db
      .select({
        id: users.id,
        email: users.email,
        role: teamMemberships.role,
      })
      .from(teamMemberships)
      .innerJoin(users, eq(users.id, teamMemberships.userId))
      .where(eq(teamMemberships.teamId, id));

    return NextResponse.json({
      team: {
        ...team,
        members,
      },
    });
  } catch (error) {
    console.error("❌ Team API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}