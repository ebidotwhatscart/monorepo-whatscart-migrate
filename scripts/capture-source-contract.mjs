import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = path.resolve(process.argv[2] ?? "../whatsCartNew");
const outputPath = path.resolve(
  process.argv[3] ?? "contracts/source-contract.json",
);

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const typescriptCandidates = [
  path.resolve(scriptRoot, "../node_modules/typescript/lib/typescript.js"),
  path.join(sourceRoot, "node_modules/typescript/lib/typescript.js"),
];
let typescriptPath;
for (const candidate of typescriptCandidates) {
  try {
    await access(candidate);
    typescriptPath = candidate;
    break;
  } catch {
    // Try the next declared installation location.
  }
}
if (!typescriptPath) {
  throw new Error(
    "TypeScript is not installed. Run `npm install` in the migration workspace.",
  );
}
const typescriptModule = await import(pathToFileURL(typescriptPath).href);
const ts = typescriptModule.default ?? typescriptModule;

const toPosix = (value) => value.split(path.sep).join("/");
const relative = (value) => toPosix(path.relative(sourceRoot, value));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }

  return files;
}

function command(...args) {
  return execFileSync(args[0], args.slice(1), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function location(sourceFile, node) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: start.line + 1, column: start.character + 1 };
}

function attributeName(attribute) {
  return attribute.name.getText(attribute.getSourceFile());
}

function findAttribute(attributes, name) {
  return attributes.properties.find(
    (attribute) => ts.isJsxAttribute(attribute) && attributeName(attribute) === name,
  );
}

function staticAttributeValue(attribute) {
  if (!attribute?.initializer) return null;
  const initializer = attribute.initializer;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (!ts.isJsxExpression(initializer) || !initializer.expression) return null;
  const expression = initializer.expression;
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text;
  }
  return null;
}

function rawAttributeValue(attribute, sourceFile) {
  if (!attribute?.initializer) return "true";
  return attribute.initializer.getText(sourceFile);
}

function contractAttributeValue(attribute, sourceFile) {
  return (
    staticAttributeValue(attribute) ??
    rawAttributeValue(attribute, sourceFile).replace(/\s+/g, " ")
  );
}

function getTagName(opening) {
  return opening.tagName.getText(opening.getSourceFile());
}

const allSourceFiles = await walk(path.join(sourceRoot, "src"));
const runtimeCodeFiles = allSourceFiles.filter((file) => {
  const rel = relative(file);
  return (
    /\.(?:ts|tsx|css)$/.test(file) &&
    !rel.includes("/__tests__/") &&
    !rel.startsWith("src/test/")
  );
});

const selectors = [];
const routes = [];
const navigations = [];
const apiUsages = [];
const staticClassTokens = new Set();
const staticIds = new Set();

for (const file of runtimeCodeFiles.filter((candidate) => /\.tsx?$/.test(candidate))) {
  const text = await readFile(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (ts.isJsxAttribute(node)) {
      const name = attributeName(node);
      if (["className", "id", "data-testid"].includes(name)) {
        const opening = node.parent?.parent;
        const staticValue = staticAttributeValue(node);
        selectors.push({
          file: relative(file),
          ...location(sourceFile, node),
          tag:
            opening &&
            (ts.isJsxOpeningElement(opening) || ts.isJsxSelfClosingElement(opening))
              ? getTagName(opening)
              : null,
          attribute: name,
          value: contractAttributeValue(node, sourceFile),
          static: staticValue !== null,
        });

        if (name === "className" && staticValue !== null) {
          for (const token of staticValue.split(/\s+/).filter(Boolean)) {
            staticClassTokens.add(token);
          }
        }
        if (name === "id" && staticValue !== null) staticIds.add(staticValue);
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = getTagName(node);
      if (tag === "Route") {
        const pathAttribute = findAttribute(node.attributes, "path");
        const indexAttribute = findAttribute(node.attributes, "index");
        const elementAttribute = findAttribute(node.attributes, "element");
        routes.push({
          file: relative(file),
          ...location(sourceFile, node),
          path: pathAttribute
            ? contractAttributeValue(pathAttribute, sourceFile)
            : null,
          index: Boolean(indexAttribute),
          element: elementAttribute
            ? contractAttributeValue(elementAttribute, sourceFile)
            : null,
        });
      }
      if (tag === "Navigate") {
        const toAttribute = findAttribute(node.attributes, "to");
        navigations.push({
          file: relative(file),
          ...location(sourceFile, node),
          to: toAttribute ? contractAttributeValue(toAttribute, sourceFile) : null,
        });
      }
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "api"
    ) {
      apiUsages.push({
        api: `api.${node.expression.name.text}.${node.name.text}`,
        file: relative(file),
        ...location(sourceFile, node),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const convexRoot = path.join(sourceRoot, "convex");
const convexFiles = (await walk(convexRoot)).filter((file) => {
  const rel = relative(file);
  return (
    file.endsWith(".ts") &&
    !rel.includes("/_generated/") &&
    !file.endsWith(".test.ts")
  );
});
const backendExports = [];
const backendKinds = new Set([
  "query",
  "mutation",
  "action",
  "internalQuery",
  "internalMutation",
  "internalAction",
  "httpAction",
]);

for (const file of convexFiles) {
  const text = await readFile(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;

    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (
        !ts.isIdentifier(declaration.name) ||
        !initializer ||
        !ts.isCallExpression(initializer) ||
        !ts.isIdentifier(initializer.expression) ||
        !backendKinds.has(initializer.expression.text)
      ) {
        continue;
      }
      backendExports.push({
        api: `api.${path.basename(file, ".ts")}.${declaration.name.text}`,
        kind: initializer.expression.text,
        file: relative(file),
        ...location(sourceFile, declaration),
      });
    }
  }
}

const schemaText = await readFile(path.join(convexRoot, "schema.ts"), "utf8");
const schemaTables = [
  ...schemaText.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*:\s*defineTable\s*\(/g),
].map((match) => match[1]);

const cssText = await readFile(path.join(sourceRoot, "src/index.css"), "utf8");
const cssVariables = [...cssText.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);/g)].map(
  ([, name, value]) => ({ name, value: value.trim() }),
);

const assetFiles = [
  ...(await walk(path.join(sourceRoot, "src/assets"))),
  ...(await walk(path.join(sourceRoot, "public"))),
];
const assets = [];
for (const file of assetFiles) {
  const info = await stat(file);
  const contents = await readFile(file);
  assets.push({
    file: relative(file),
    bytes: info.size,
    sha256: sha256(contents),
  });
}

const configPaths = [
  "index.html",
  "tailwind.config.js",
  "vite.config.ts",
  "netlify.toml",
  "netlify/edge-functions/share-meta.js",
  "cloudflare/tenant-proxy.ts",
  "cloudflare/wrangler.jsonc",
  "twa-manifest.json",
  "app/src/main/AndroidManifest.xml",
  "bubblewrap/twa-manifest.json",
  "bubblewrap/app/src/main/AndroidManifest.xml",
];
const platformConfigs = [];
for (const configPath of configPaths) {
  const absolute = path.join(sourceRoot, configPath);
  try {
    const contents = await readFile(absolute);
    platformConfigs.push({ file: configPath, sha256: sha256(contents) });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const androidTrackedPaths = command(
  "git",
  "-C",
  sourceRoot,
  "ls-files",
  "app",
  "bubblewrap",
  "twa-manifest.json",
  "build.gradle",
  "settings.gradle",
  "gradle.properties",
  "public/well-known/assetlinks.json",
)
  .split("\n")
  .filter(Boolean)
  .filter((file) => !/\.(?:apk|aab|idsig|jar)$/.test(file));
const androidFiles = [];
for (const file of androidTrackedPaths) {
  const contents = await readFile(path.join(sourceRoot, file));
  androidFiles.push({
    file,
    bytes: contents.byteLength,
    sha256: sha256(contents),
  });
}

const searchableFiles = [
  ...runtimeCodeFiles,
  ...convexFiles,
  ...platformConfigs.map(({ file }) => path.join(sourceRoot, file)),
];
const hosts = new Set();
for (const file of searchableFiles) {
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/\b(?:[a-z0-9-]+\.)*whatscart\.in\b/gi)) {
    hosts.add(match[0].toLowerCase());
  }
}

const runtimeFileHashes = [];
for (const file of runtimeCodeFiles) {
  runtimeFileHashes.push({
    file: relative(file),
    sha256: sha256(await readFile(file)),
  });
}

const uniqueApiUsages = [...new Map(
  apiUsages.map((usage) => [
    `${usage.api}:${usage.file}:${usage.line}:${usage.column}`,
    usage,
  ]),
).values()];

const contract = {
  formatVersion: 1,
  capturedAt: new Date().toISOString(),
  source: {
    repository: sourceRoot,
    commit: command("git", "-C", sourceRoot, "rev-parse", "HEAD"),
    dirty: command("git", "-C", sourceRoot, "status", "--porcelain") !== "",
  },
  summary: {
    runtimeFiles: runtimeCodeFiles.length,
    selectors: selectors.length,
    classNameAttributes: selectors.filter(({ attribute }) => attribute === "className")
      .length,
    idAttributes: selectors.filter(({ attribute }) => attribute === "id").length,
    uniqueStaticClassTokens: staticClassTokens.size,
    uniqueStaticIds: staticIds.size,
    routes: routes.length,
    frontendApiUsages: uniqueApiUsages.length,
    backendExports: backendExports.length,
    schemaTables: schemaTables.length,
    assets: assets.length,
    androidFiles: androidFiles.length,
  },
  domains: [...hosts].sort(),
  routes: routes.sort((a, b) =>
    `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`),
  ),
  navigations: navigations.sort((a, b) =>
    `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`),
  ),
  ui: {
    cssVariables,
    selectors: selectors.sort((a, b) =>
      `${a.file}:${a.line}:${a.column}`.localeCompare(
        `${b.file}:${b.line}:${b.column}`,
      ),
    ),
    staticClassTokens: [...staticClassTokens].sort(),
    staticIds: [...staticIds].sort(),
  },
  data: {
    schemaTables,
    frontendApiUsages: uniqueApiUsages.sort((a, b) =>
      `${a.api}:${a.file}:${a.line}`.localeCompare(`${b.api}:${b.file}:${b.line}`),
    ),
    backendExports: backendExports.sort((a, b) => a.api.localeCompare(b.api)),
  },
  assets: assets.sort((a, b) => a.file.localeCompare(b.file)),
  android: {
    files: androidFiles.sort((a, b) => a.file.localeCompare(b.file)),
  },
  platformConfigs,
  runtimeFileHashes: runtimeFileHashes.sort((a, b) =>
    a.file.localeCompare(b.file),
  ),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(contract, null, 2)}\n`);
console.log(JSON.stringify(contract.summary, null, 2));
