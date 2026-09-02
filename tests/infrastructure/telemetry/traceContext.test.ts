import { runWithTrace, getTraceId, generateTraceId } from "../../../src/infrastructure/telemetry/traceContext";

describe("traceContext", () => {
  describe("generateTraceId", () => {
    it("should return a string", () => {
      const traceId = generateTraceId();
      expect(typeof traceId).toBe("string");
      expect(traceId.length).toBeGreaterThan(0);
    });
  });

  describe("getTraceId", () => {
    it("should return an empty string outside of a trace context", () => {
      expect(getTraceId()).toBe("");
    });
  });

  describe("runWithTrace", () => {
    it("should provide traceId to synchronous callbacks", () => {
      const traceId = generateTraceId();
      runWithTrace(traceId, () => {
        expect(getTraceId()).toBe(traceId);
      });
    });

    it("should provide traceId across asynchronous operations", async () => {
      const traceId = generateTraceId();
      await runWithTrace(traceId, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(getTraceId()).toBe(traceId);
      });
    });

    it("should maintain nested trace contexts correctly", () => {
      const outerTraceId = generateTraceId();
      const innerTraceId = generateTraceId();

      runWithTrace(outerTraceId, () => {
        expect(getTraceId()).toBe(outerTraceId);

        runWithTrace(innerTraceId, () => {
          expect(getTraceId()).toBe(innerTraceId);
        });

        expect(getTraceId()).toBe(outerTraceId);
      });
    });
  });
});
