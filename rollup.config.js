import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

export default [
  {
    input: "index.js",
    output: {
      file: "index.cjs",
      format: "cjs",
    },
    plugins: [resolve(), commonjs()],
  },
  {
    input: "index.js",
    output: {
      file: "index.mjs",
      format: "es",
    },
    plugins: [resolve(), commonjs()],
  },
];
