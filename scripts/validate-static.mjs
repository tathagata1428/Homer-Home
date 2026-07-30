import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const failures = [];

function fail(message) {
  failures.push(message);
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) fail(`Duplicate HTML ids: ${duplicateIds.join(', ')}`);

const localReferences = [...html.matchAll(/(?:href|src)=["'](\/[^"'?#]+)[^"']*["']/g)]
  .map((match) => match[1])
  .filter((reference) => !reference.startsWith('/api/'));
const missing = [...new Set(localReferences)].filter((reference) => !fs.existsSync(path.join(root, reference.slice(1))));
if (missing.length) fail(`Missing local assets: ${missing.join(', ')}`);

const activeScripts = [...html.matchAll(/<script[^>]+src=["'](\/assets\/[^"'?]+\.js)[^"']*["']/g)]
  .map((match) => path.join(root, match[1].slice(1)));
activeScripts.forEach((filename) => {
  try {
    new vm.Script(fs.readFileSync(filename, 'utf8'), { filename });
  } catch (error) {
    fail(`JavaScript syntax error in ${path.relative(root, filename)}: ${error.message}`);
  }
});

const activeStyles = [...html.matchAll(/<link[^>]+href=["'](\/assets\/[^"'?]+\.css)[^"']*["']/g)]
  .map((match) => path.join(root, match[1].slice(1)));
activeStyles.forEach((filename) => {
  const css = fs.readFileSync(filename, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
  let balance = 0;
  for (const character of css) {
    if (character === '{') balance += 1;
    if (character === '}') balance -= 1;
    if (balance < 0) break;
  }
  if (balance !== 0) fail(`Unbalanced CSS braces in ${path.relative(root, filename)}`);
});

const sensitivePattern = /(qaz123|cWF6MTIzcGwu|SB_AUTO_PASS)/i;
const sensitiveFiles = [
  htmlPath,
  ...activeScripts,
  path.join(root, 'homer-android', 'app', 'build.gradle.kts')
];
sensitiveFiles.forEach((filename) => {
  if (sensitivePattern.test(fs.readFileSync(filename, 'utf8'))) {
    fail(`Potential embedded credential in ${path.relative(root, filename)}`);
  }
});

if (failures.length) {
  console.error(failures.map((message) => `- ${message}`).join('\n'));
  process.exit(1);
}

console.log(`Homer static check passed: ${ids.length} ids, ${localReferences.length} local references, ${activeScripts.length} scripts.`);
