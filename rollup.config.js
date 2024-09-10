import commonjs from "@rollup/plugin-commonjs";
import json from '@rollup/plugin-json';
import resolve from "@rollup/plugin-node-resolve";

export default [
  {
    input: "index.js",
    output: {
      file: "index.cjs",
      format: "cjs",
      banner: "#!/usr/bin/env node",
    },
    plugins: [resolve(), commonjs(), json()],
  },
  {
    input: "index.js",
    output: {
      file: "index.mjs",
      format: "es",
      banner: "#!/usr/bin/env node",
    },
    plugins: [resolve(), commonjs(), json()],
  }
];
