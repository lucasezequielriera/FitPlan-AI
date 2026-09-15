/** @type {import('jest').Config} */
export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      { tsconfig: "tsconfig.json", useESM: true }
    ],
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // `.claude/worktrees/` son copias del repo que crean los agentes cuando
  // trabajan en paralelo. Viven DENTRO del proyecto, así que Jest recogía sus
  // tests: la suite corría tres veces, con versiones distintas del código, y
  // los recuentos salían inflados. Pasó dos veces antes de que se entendiera
  // de dónde venían los fallos.
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/.claude/worktrees/"],
};

