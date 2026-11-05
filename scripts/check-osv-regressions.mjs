import { readFileSync } from 'node:fs';

function readFindings(path, outcome) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  const [run] = report.runs ?? [];
  if (report.runs?.length !== 1 || run.tool?.driver?.name !== 'osv-scanner' || !Array.isArray(run.results)) {
    throw new Error(`Invalid OSV report: ${path}`);
  }
  if (outcome !== (run.results.length > 0 ? 'failure' : 'success')) {
    throw new Error(`The OSV scan outcome does not match its report: ${path}`);
  }

  const findings = new Set();
  for (const result of run.results) {
    const packageVersion = /^Package '([^']+)' is vulnerable to /.exec(result.message?.text)?.[1];
    if (!packageVersion || typeof result.ruleId !== 'string' || !result.ruleId) {
      throw new Error(`Unrecognized OSV finding in ${path}`);
    }
    findings.add(`${packageVersion} | ${result.ruleId}`);
  }
  return findings;
}

try {
  const [currentPath, currentOutcome, basePath, baseOutcome] = process.argv.slice(2);
  const current = readFindings(currentPath, currentOutcome);
  if (basePath) {
    const baseline = readFindings(basePath, baseOutcome);
    const introduced = [...current].filter(finding => !baseline.has(finding)).sort();
    if (introduced.length) {
      throw new Error(`New vulnerable dependency versions:\n${introduced.join('\n')}`);
    }
    console.log(`OSV: ${current.size} existing findings, no new vulnerable dependency versions.`);
  } else {
    console.log(`OSV: ${current.size} findings in the current report.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
