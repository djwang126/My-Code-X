import { Router } from "express";
import { addWorkspaceRequestSchema } from "@my-code-x/app-types";
import { ok } from "../api-response";
import { AppError } from "../app-error";
import type { WorkspaceStore } from "./workspace-store";

export interface WorkspaceRoutesInput {
  workspaceStore: WorkspaceStore;
}

export function workspaceRoutes(input: WorkspaceRoutesInput) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const workspaces = await input.workspaceStore.list();
    res.json(ok(workspaces));
  });

  router.post("/", async (req, res) => {
    const request = addWorkspaceRequestSchema.safeParse(req.body);
    if (!request.success) {
      throw new AppError({
        code: "INVALID_REQUEST",
        message: "Invalid workspace request",
        status: 400,
        retryable: false
      });
    }

    const workspace = await input.workspaceStore.add(request.data);
    res.status(201).json(ok(workspace));
  });

  return router;
}
