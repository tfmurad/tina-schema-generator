#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

function main() {
  const contentDir = path.join("src", "content");
  const outputDir = path.join("tina", "collections");
  const configDir = path.join("src", "config");
  const globalDir = path.join("tina", "global");
  const configFilePath = path.join("tina", "config.js");

  const rootContentDir = path.join("content");

  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg"];

  const humanize = (content) => {
    return content
      .replace(/^[\s_]+|[\s_]+$/g, "")
      .replace(/[_\s]+/g, " ")
      .replace(/[-\s]+/g, " ")
      .replace(/^[a-z]/, function (m) {
        return m.toUpperCase();
      });
  };

  const toCamelCase = (str) => {
    return str
      .replace(/-./g, (match) => match.charAt(1).toUpperCase())
      .replace(/\.md[x]?$/, "");
  };

  const parseFields = (data) => {
    return Object.keys(data).map((key) => {
      let fieldType = typeof data[key];
      if (fieldType === "object" && Array.isArray(data[key])) {
        fieldType = "array";
      }

      if (fieldType === "array") {
        if (data[key].length) {
          if (typeof data[key][0] === "object") {
            return {
              name: key,
              label: humanize(key),
              type: "object",
              fields: parseFields(data[key][0]),
              list: true,
            };
          } else {
            return {
              name: key,
              label: humanize(key),
              type: typeof data[key][0],
              list: true,
            };
          }
        } else {
          return {
            name: key,
            label: humanize(key),
            type: "string",
            list: true,
          };
        }
      }

      if (key.toLowerCase() === "date") {
        return { name: key, label: humanize(key), type: "datetime" };
      }

      if (
        fieldType === "string" &&
        imageExtensions.some((ext) => data[key].toLowerCase().endsWith(ext))
      ) {
        fieldType = "image";
      }

      if (fieldType === "object" && data[key] !== null) {
        const fields = parseFields(data[key]);
        // Ensure there's at least one field defined for nested objects
        if (fields.length === 0) {
          fields.push({
            name: "field",
            label: "Field",
            type: "string",
          });
        }
        return {
          name: key,
          label: humanize(key),
          type: "object",
          fields,
        };
      }

      // default case to handle any unexpected types
      if (
        ![
          "string",
          "boolean",
          "number",
          "datetime",
          "image",
          "object",
        ].includes(fieldType)
      ) {
        fieldType = "string";
      }

      return { name: key, label: humanize(key), type: fieldType, fields: [] };
    });
  };

  const generateCollectionSchema = (
    name,
    collectionPath,
    markdown,
    type,
    filename
  ) => {
    const { data } = matter(markdown);
    const fields = parseFields(data);

    fields.push({
      type: "rich-text",
      name: "body",
      label: "Body of Document",
      description: "This is the markdown body",
      isBody: true,
    });

    const schemaName = `${name}${type === "list" ? "List" : "Single"}`;
    const readableName = `${name}${type === "list" ? " List" : " Single"}`;
    const format = path.extname(filename).substring(1);

    const schema = {
      label: humanize(readableName),
      name: schemaName,
      path: `src/content/${collectionPath}`,
      format,
      fields,
      match: {
        include: type === "list" ? "{-index,-template}" : "**/*",
        exclude: type === "list" ? undefined : "{-index,-template}",
      },
    };

    if (type === "list") {
      schema.ui = {
        global: true,
        allowedActions: {
          create: true,
          delete: true,
        },
      };
    }

    return schema;
  };

  const generateConfigSchema = (name, configData) => {
    const fields = parseFields(configData);

    const schema = {
      label: humanize(name),
      name: name,
      path: `src/config`,
      format: "json",
      ui: {
        global: true,
        allowedActions: {
          create: false,
          delete: false,
        },
      },
      match: {
        include: `${name}`,
      },
      fields,
    };

    return schema;
  };

  const walkSync = (dir, filelist = []) => {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filepath = path.join(dir, file);
      if (fs.statSync(filepath).isDirectory()) {
        filelist = walkSync(filepath, filelist);
      } else {
        filelist.push(filepath);
      }
    });
    return filelist;
  };

  const deleteFolderRecursive = (dirPath) => {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach((file) => {
        const currentPath = path.join(dirPath, file);
        if (fs.lstatSync(currentPath).isDirectory()) {
          deleteFolderRecursive(currentPath);
        } else {
          fs.unlinkSync(currentPath);
        }
      });
      fs.rmdirSync(dirPath);
    }
  };

  // Delete the 'content' folder in the root directory
  deleteFolderRecursive(rootContentDir);

  const markdownFiles = walkSync(contentDir).filter((file) => {
    const isMdx = file.endsWith(".mdx");
    const isMd = file.endsWith(".md");
    return isMdx || isMd;
  });

  const jsonFiles = fs.existsSync(configDir)
    ? walkSync(configDir).filter((file) => file.endsWith(".json"))
    : [];

  const schemas = {};
  const configSchemas = {};

  markdownFiles.forEach((file) => {
    const relativePath = path.relative(contentDir, file);
    const [folder, filename] = relativePath.split(path.sep);
    const fileType = filename.startsWith("-index") ? "list" : "single";
    const schemaName = `${toCamelCase(folder)}${
      fileType === "list" ? "List" : "Single"
    }`;
    const markdown = fs.readFileSync(file, "utf8");
    const schema = generateCollectionSchema(
      toCamelCase(folder),
      path.dirname(relativePath),
      markdown,
      fileType,
      filename
    );

    schemas[schemaName] = schema;
  });

  jsonFiles.forEach((file) => {
    const relativePath = path.relative(configDir, file);
    const configName = path.basename(file, ".json");
    const configData = JSON.parse(fs.readFileSync(file, "utf8"));
    const schema = generateConfigSchema(configName, configData);

    configSchemas[configName] = schema;
  });

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (!fs.existsSync(globalDir)) {
    fs.mkdirSync(globalDir, { recursive: true });
  }

  Object.keys(schemas).forEach((key) => {
    const outputPath = path.join(outputDir, `${key}.js`);
    const schemaContent = `export default ${JSON.stringify(
      schemas[key],
      null,
      2
    )
      .replace(/"([^"]+)":/g, "$1:")
      .replace(/"/g, "'")};`;
    fs.writeFileSync(outputPath, schemaContent);
  });

  Object.keys(configSchemas).forEach((key) => {
    const outputPath = path.join(globalDir, `${key}.js`);
    const schemaContent = `export default ${JSON.stringify(
      configSchemas[key],
      null,
      2
    )
      .replace(/"([^"]+)":/g, "$1:")
      .replace(/"/g, "'")};`;
    fs.writeFileSync(outputPath, schemaContent);
  });

  // Read config.js content
  let configContent = fs.readFileSync(configFilePath, "utf8");

  // Function to check if import statement exists in config.js
  const importExists = (content, importPath) => {
    const importRegex = new RegExp(
      `import\\s+\\w+\\s+from\\s+"${importPath}";`
    );
    return importRegex.test(content);
  };

  // Function to check if collection exists in config.js
  const collectionExists = (content, collectionName) => {
    const collectionRegex = new RegExp(`\\b${collectionName}\\b`);
    return collectionRegex.test(content);
  };

  // Update config.js with import statements and collections
  const importStatements = Object.keys(schemas)
    .map((key) => {
      const importPath = `./collections/${key}`;
      if (!importExists(configContent, importPath)) {
        return `import ${key} from "${importPath}";`;
      }
      return null;
    })
    .filter(Boolean);

  const globalImportStatements = Object.keys(configSchemas)
    .map((key) => {
      const importPath = `./global/${key}`;
      if (!importExists(configContent, importPath)) {
        return `import ${key} from "${importPath}";`;
      }
      return null;
    })
    .filter(Boolean);

  const allImportStatements = [...importStatements, ...globalImportStatements];
  if (allImportStatements.length > 0) {
    configContent = configContent.replace(
      /import { defineConfig } from "tinacms";/,
      `import { defineConfig } from "tinacms";\n${allImportStatements.join(
        "\n"
      )}`
    );
  }

  const currentCollections =
    (configContent.match(/collections:\s*\[\s*([\s\S]*?)\s*\],/) || [])[1] ||
    "";
  const newCollections = Object.keys(schemas)
    .concat(Object.keys(configSchemas))
    .filter((key) => {
      return !collectionExists(currentCollections, key);
    });

  if (newCollections.length > 0) {
    const allCollections = currentCollections
      .split(",")
      .map((collection) => collection.trim())
      .filter(Boolean)
      .concat(newCollections)
      .join(",\n");

    configContent = configContent.replace(
      /collections:\s*\[\s*([\s\S]*?)\s*\],/,
      `collections: [\n${allCollections}\n],`
    );
  }

  fs.writeFileSync(configFilePath, configContent);

  // Update package.json scripts
  const packageJsonPath = path.join("package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  Object.keys(packageJson.scripts).forEach((script) => {
    if (
      packageJson.scripts[script].includes("astro dev") &&
      !packageJson.scripts[script].includes('tinacms dev -c "astro dev"')
    ) {
      packageJson.scripts[script] = packageJson.scripts[script].replace(
        /astro dev/g,
        'tinacms dev -c "astro dev"'
      );
    }
  });

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  console.log(
    "\x1b[32m%s\x1b[0m \x1b[32m%s\x1b[0m",
    "➡ ",
    "Schemas generated, imports added to config.js successfully."
  );
}

main();
