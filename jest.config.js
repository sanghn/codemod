module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // or 'jsdom' if you're testing browser code
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
};
