module.exports = {
  "testEnvironment": "node",
  "transform": {
    "^.+\\.(t|j)sx?$": "ts-jest"
  },
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js",
    "json",
    "node"
  ],
  "testMatch": [
    "**/__tests__/**/*.test.ts",
    "**/?(*.)+(spec|test).ts"
  ],
  "preset": "ts-jest"
};