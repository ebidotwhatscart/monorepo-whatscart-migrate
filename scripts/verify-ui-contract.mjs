import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const targetRoot = path.resolve(process.argv[2] ?? ".");
const baselinePath = path.resolve(
  process.argv[3] ?? "contracts/source-contract.json",
);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const typescriptPath = path.resolve(
  scriptRoot,
  "../node_modules/typescript/lib/typescript.js",
);
const typescriptModule = await import(pathToFileURL(typescriptPath).href);
const ts = typescriptModule.default ?? typescriptModule;
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));

async function exists(value) {
  try {
    await access(value);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (
      entry.isDirectory() &&
      ["node_modules", ".next", ".git", "dist", "build", "__tests__", "test"].includes(
        entry.name,
      )
    ) {
      continue;
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function attributeName(attribute) {
  return attribute.name.getText(attribute.getSourceFile());
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

function contractValue(attribute, sourceFile) {
  if (!attribute.initializer) return "true";
  return (
    staticAttributeValue(attribute) ??
    attribute.initializer.getText(sourceFile).replace(/\s+/g, " ")
  );
}

function multiset(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function selectorKey({ attribute, value }) {
  return `${attribute}\u0000${value}`;
}

function compareMultisets(expected, actual) {
  const missing = [];
  const unexpected = [];
  for (const [key, count] of expected) {
    const delta = count - (actual.get(key) ?? 0);
    if (delta > 0) missing.push({ key, count: delta });
  }
  for (const [key, count] of actual) {
    const delta = count - (expected.get(key) ?? 0);
    if (delta > 0) unexpected.push({ key, count: delta });
  }
  return { missing, unexpected };
}

function displaySelector({ key, count }) {
  const [attribute, value] = key.split("\u0000");
  return { attribute, value, count };
}

const candidateRoots = ["src", "app", "components"]
  .map((directory) => path.join(targetRoot, directory));
const existingRoots = [];
for (const candidate of candidateRoots) {
  if (await exists(candidate)) existingRoots.push(candidate);
}
if (existingRoots.length === 0) {
  throw new Error(
    `No runtime UI directories found under ${targetRoot}; expected src, app, or components.`,
  );
}

const targetTsxFiles = [];
for (const root of existingRoots) {
  targetTsxFiles.push(...(await walk(root)).filter((file) => file.endsWith(".tsx")));
}

const targetSelectors = [];
for (const file of [...new Set(targetTsxFiles)]) {
  const text = await readFile(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function visit(node) {
    if (ts.isJsxAttribute(node)) {
      const attribute = attributeName(node);
      if (["className", "id", "data-testid"].includes(attribute)) {
        targetSelectors.push({
          attribute,
          value: contractValue(node, sourceFile),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const selectorDiff = compareMultisets(
  multiset(baseline.ui.selectors.map(selectorKey)),
  multiset(targetSelectors.map(selectorKey)),
);

const changedAssets = [];
for (const asset of baseline.assets) {
  const targetPath = path.join(targetRoot, asset.file);
  if (!(await exists(targetPath))) {
    changedAssets.push({ file: asset.file, issue: "missing" });
    continue;
  }
  const actualHash = createHash("sha256")
    .update(await readFile(targetPath))
    .digest("hex");
  if (actualHash !== asset.sha256) {
    changedAssets.push({
      file: asset.file,
      issue: "hash-mismatch",
      expected: asset.sha256,
      actual: actualHash,
    });
  }
}

const report = {
  passed:
    selectorDiff.missing.length === 0 &&
    selectorDiff.unexpected.length === 0 &&
    changedAssets.length === 0,
  expectedSelectorCount: baseline.ui.selectors.length,
  actualSelectorCount: targetSelectors.length,
  missingSelectors: selectorDiff.missing.map(displaySelector),
  unexpectedSelectors: selectorDiff.unexpected.map(displaySelector),
  changedAssets,
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;

