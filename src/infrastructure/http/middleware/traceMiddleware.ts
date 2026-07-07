import { Request, Response, NextFunction } from "express";
import { runWithTrace, generateTraceId } from "../../telemetry/traceContext";

export function traceMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerTraceId = req.headers["x-trace-id"] || req.headers["traceparent"];
  const traceId = typeof headerTraceId === "string" ? headerTraceId : generateTraceId();

  res.setHeader("x-trace-id", traceId);

  runWithTrace(traceId, () => {
    next();
  });
}
