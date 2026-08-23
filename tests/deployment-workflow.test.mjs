import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);

async function readWorkflow() {
  return readFile(new URL('.github/workflows/deploy.yml', projectRoot), 'utf8');
}

function positionOf(workflow, pattern, description) {
  const match = pattern.exec(workflow);
  assert.ok(match, `Expected the Pages workflow to ${description}`);
  return match.index;
}

test('Pages deployment runs the complete Node and Python suites before Hugo builds', async () => {
  const workflow = await readWorkflow();

  assert.match(workflow, /uses:\s*actions\/setup-node@v4/);
  assert.match(workflow, /node-version:\s*['"]?22['"]?/);
  assert.match(workflow, /uses:\s*actions\/setup-python@v5/);
  assert.match(workflow, /python-version:\s*['"]3\.11['"]/);

  const nodeTests = positionOf(
    workflow,
    /node --test tests\/\*\.test\.mjs tests\/\*\/\*\.test\.mjs/,
    'run every tracked Node test',
  );
  const pythonRequirements = positionOf(
    workflow,
    /python -m pip install -r requirements-image-system\.txt/,
    'install the Python image-system requirements',
  );
  const pythonTests = positionOf(
    workflow,
    /python -m unittest discover -s tests -p ['"]test_\*\.py['"]/,
    'run every tracked Python test',
  );
  const hugoBuild = positionOf(
    workflow,
    /hugo --gc --minify --baseURL/,
    'build the production site with Hugo',
  );

  assert.ok(nodeTests < hugoBuild, 'Node tests must pass before Hugo builds');
  assert.ok(pythonRequirements < pythonTests, 'Python requirements must be installed before Python tests run');
  assert.ok(pythonTests < hugoBuild, 'Python tests must pass before Hugo builds');
});
