import { z } from "zod";
import { apiResponseSchema } from "./api-response";

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  canonicalCwd: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type Workspace = z.infer<typeof workspaceSchema>;

export const workspaceListSchema = z.array(workspaceSchema);
export type WorkspaceList = z.infer<typeof workspaceListSchema>;

export const addWorkspaceRequestSchema = z.object({
  name: z.string().optional(),
  cwd: z.string()
});

export type AddWorkspaceRequest = z.infer<typeof addWorkspaceRequestSchema>;

export const workspaceListResponseSchema = apiResponseSchema(workspaceListSchema);
export const workspaceResponseSchema = apiResponseSchema(workspaceSchema);
