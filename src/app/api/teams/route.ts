/**
 * GET /api/teams — Get all teams for the authenticated user
 * POST /api/teams — Create a new team
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { teams, teamMemberships, users, organizations } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, organizationId } = body;

    if (!name) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    // Create the team
    const [newTeam] = await db.insert(teams).values({
      id: uuidv4(),
      name,
      description: description || '',
      organizationId: organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Add the creator as team owner
    await db.insert(teamMemberships).values({
      id: uuidv4(),
      userId: auth.userId,
      teamId: newTeam.id,
      role: 'owner',
      createdAt: new Date(),
    });

    return NextResponse.json({
      team: newTeam,
    });
  } catch (error) {
    console.error("❌ Team Create API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all teams the user is a member of
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        organizationId: teams.organizationId,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
      })
      .from(teams)
      .innerJoin(teamMemberships, eq(teams.id, teamMemberships.teamId))
      .where(eq(teamMemberships.userId, auth.userId));

    return NextResponse.json({
      teams: userTeams,
    });
  } catch (error) {
    console.error("❌ Teams API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}