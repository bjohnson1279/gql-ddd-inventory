import { Request, Response, NextFunction } from "express";
import { traceMiddleware } from "../../../../src/infrastructure/http/middleware/traceMiddleware";
import { getTraceId } from "../../../../src/infrastructure/telemetry/traceContext";

describe("traceMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      setHeader: jest.fn(),
    };
    next = jest.fn();
  });

  it("should use x-trace-id header if present", () => {
    req.headers!["x-trace-id"] = "trace-123";

    let capturedTraceId: string | null = null;
    next = jest.fn(() => {
      capturedTraceId = getTraceId();
    });

    traceMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith("x-trace-id", "trace-123");
    expect(next).toHaveBeenCalled();
    expect(capturedTraceId).toBe("trace-123");
  });

  it("should use traceparent header if x-trace-id is absent", () => {
    req.headers!["traceparent"] = "trace-456";

    let capturedTraceId: string | null = null;
    next = jest.fn(() => {
      capturedTraceId = getTraceId();
    });

    traceMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith("x-trace-id", "trace-456");
    expect(next).toHaveBeenCalled();
    expect(capturedTraceId).toBe("trace-456");
  });

  it("should generate a new trace ID if no header is present", () => {
    let capturedTraceId: string | null = null;
    next = jest.fn(() => {
      capturedTraceId = getTraceId();
    });

    traceMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith("x-trace-id", expect.any(String));
    expect(next).toHaveBeenCalled();
    expect(capturedTraceId).toBeTruthy();
    expect(typeof capturedTraceId).toBe("string");
  });
});
