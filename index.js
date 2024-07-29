#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { select } = require("@inquirer/prompts");
const vm = require("vm");

// Function to fetch and run script from URL
async function fetchAndRunScript(url) {
  try {
    const response = await axios.get(url);
    const script = new vm.Script(response.data);
    const context = vm.createContext({ require, console, process });
    script.runInContext(context);
  } catch (error) {
    console.error("Error fetching or running the script:", error);
  }
}

// Function to set up the package
async function setup() {
  const moduleType = await select({
    message: "Is your project using CommonJS or ES Modules?",
    choices: [
      { name: "CommonJS", value: "CommonJS" },
      { name: "ES Modules", value: "ES Modules" },
    ],
  });

  const scriptUrl =
    moduleType === "CommonJS"
      ? "https://raw.githubusercontent.com/tfmurad/tina-schema-generator/main/scripts/generate-tina-schema.cjs"
      : "https://raw.githubusercontent.com/tfmurad/tina-schema-generator/main/scripts/generate-tina-schema.mjs";

  await fetchAndRunScript(scriptUrl);
}

// Path to check the 'tina' folder in the project root
const projectRoot = process.cwd();
const tinaFolderPath = path.join(projectRoot, "tina");

// Check if the 'tina' folder exists
fs.access(tinaFolderPath, fs.constants.F_OK, (err) => {
  if (!err) {
    setup();
  } else {
    console.log(
      'The "tina" folder does not exist. Please visit the following link to install the Tina package first:'
    );
    console.log("https://docs.astro.build/en/guides/cms/tina-cms/");
  }
});
