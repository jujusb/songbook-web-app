import { NextResponse } from "next/server";
import { listUsers, saveUser, getUser, deleteUser } from "@/lib/auth";
import { getSession, canAdmin } from "@/lib/auth";
import { isReadOnlyFor } from "@/lib/readonly";
import { PermissionSchema } from "@/lib/auth/schemas";

export async function GET() {
  if (isReadOnlyFor('user_write')) {
    return NextResponse.json({ error: "Read-only mode" }, { status: 403 });
  }
  const session = await getSession();
  if (!canAdmin(session?.role ?? null)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await listUsers();
  // Remove password hashes from response
  const safeUsers = users.map(({ passwordHash, ...user }) => user);
  return NextResponse.json(safeUsers);
}

export async function PUT(request: Request) {
  if (isReadOnlyFor('user_write')) {
    return NextResponse.json({ error: "Read-only mode" }, { status: 403 });
  }
  const session = await getSession();
  if (!session || !canAdmin(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, permissions, role, displayName, email } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Prevent self-demotion
    if (userId === session.userId) {
      return NextResponse.json({ error: "Cannot modify your own permissions" }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Validate permissions if provided
    let validatedPermissions = user.permissions;
    if (permissions) {
      const result = PermissionSchema.safeParse(permissions);
      if (!result.success) {
        return NextResponse.json({ error: "Invalid permissions format" }, { status: 400 });
      }
      validatedPermissions = result.data;
    }

    // Update user
    const updatedUser = {
      ...user,
      ...(role && { role }),
      ...(displayName !== undefined && { displayName }),
      ...(email !== undefined && { email }),
      ...(permissions && { permissions: validatedPermissions }),
    };

    await saveUser(updatedUser);

    const { passwordHash, ...safeUser } = updatedUser;
    return NextResponse.json(safeUser);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (isReadOnlyFor('user_write')) {
    return NextResponse.json({ error: "Read-only mode" }, { status: 403 });
  }
  const session = await getSession();
  if (!session || !canAdmin(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("id");

  if (!userId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Prevent self-deletion
  if (userId === session.userId) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  try {
    const { deleteUser } = await import("@/lib/auth");
    await deleteUser(userId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}