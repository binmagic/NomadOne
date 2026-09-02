import { NextRequest } from "next/server";

import { withAuthedUser } from "@/lib/auth/session";
import { createProject, listProjects } from "@/lib/services/project-service";
import { projectCreateSchema } from "@/lib/validations/project";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET() {
  try {
    return await withAuthedUser(async (user) => {
      const projects = await listProjects(user.id);
      return ok(projects);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withAuthedUser(async (user) => {
      const input = projectCreateSchema.parse(await request.json());
      const project = await createProject(input, user.id);
      return ok(project, { status: 201 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
