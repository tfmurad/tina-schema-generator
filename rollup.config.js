const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const resolve = require("@rollup/plugin-node-resolve");

module.exports = [
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
