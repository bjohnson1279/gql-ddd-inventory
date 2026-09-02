import { runWithTrace, getTraceId, generateTraceId } from "../../../src/infrastructure/telemetry/traceContext";

describe("traceContext", () => {
  describe("generateTraceId", () => {
    it("should return a valid UUID string", () => {
      const traceId = generateTraceId();
      expect(typeof traceId).toBe("string");
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(traceId).toMatch(uuidRegex);
    });

    it("should generate distinct IDs on subsequent calls", () => {
      const id1 = generateTraceId();
      const id2 = generateTraceId();
      expect(id1).not.toEqual(id2);
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
