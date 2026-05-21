import type { ErrorRequestHandler } from "express";
import { failureFromError } from "./api-response";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  const failure = failureFromError(error);
  res.status(failure.status).json(failure.body);
};
