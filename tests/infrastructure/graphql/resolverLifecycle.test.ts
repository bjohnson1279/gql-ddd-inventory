describe('resolver background maintenance lifecycle', () => {
  it('schedules login cleanup without keeping the process alive', () => {
    const interval = jest.spyOn(global, 'setInterval');
    try {
      jest.isolateModules(() => {
        require('../../../src/infrastructure/graphql/resolvers');
      });
      const index = interval.mock.calls.findIndex(([, delay]) => delay === 15 * 60 * 1000);
      expect(index).toBeGreaterThanOrEqual(0);
      const timer = interval.mock.results[index].value as NodeJS.Timeout;
      expect(timer.hasRef()).toBe(false);
    } finally {
      // Do not leave this test's fresh module instance or a failed assertion
      // responsible for an extra interval in the rest of the suite.
      for (const result of interval.mock.results) {
        if (result.type === 'return') clearInterval(result.value);
      }
      interval.mockRestore();
    }
  });
});
