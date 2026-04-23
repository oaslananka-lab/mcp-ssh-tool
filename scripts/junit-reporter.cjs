const fs = require("node:fs");
const path = require("node:path");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toSeconds(durationMs) {
  return (Number(durationMs ?? 0) / 1000).toFixed(3);
}

function relativeSuiteName(testFilePath) {
  if (!testFilePath) {
    return "unknown";
  }

  return path.relative(process.cwd(), testFilePath).replace(/\\/g, "/");
}

function renderFailureBody(assertion) {
  const details =
    assertion.failureMessages?.join("\n\n") ?? assertion.failureDetails?.join?.("\n\n") ?? "";
  return details.trim();
}

function renderTestCase(assertion, suiteName) {
  const name = escapeXml(assertion.fullName || assertion.title || "unnamed test");
  const classname = escapeXml(suiteName);
  const time = toSeconds(assertion.duration);

  if (assertion.status === "pending" || assertion.status === "todo") {
    return `    <testcase classname="${classname}" name="${name}" time="${time}"><skipped/></testcase>`;
  }

  if (assertion.status === "failed") {
    const message = renderFailureBody(assertion);
    return [
      `    <testcase classname="${classname}" name="${name}" time="${time}">`,
      `      <failure message="${escapeXml(assertion.title || "Test failed")}">${escapeXml(message)}</failure>`,
      "    </testcase>",
    ].join("\n");
  }

  return `    <testcase classname="${classname}" name="${name}" time="${time}" />`;
}

function renderSuiteExecutionError(suiteName, suiteResult) {
  const message =
    suiteResult.failureMessage ||
    suiteResult.testExecError?.message ||
    "Suite failed before assertions ran";
  return [
    `    <testcase classname="${escapeXml(suiteName)}" name="${escapeXml(suiteName)}" time="${toSeconds(suiteResult.perfStats?.runtime)}">`,
    `      <error message="Suite execution error">${escapeXml(message)}</error>`,
    "    </testcase>",
  ].join("\n");
}

function countByStatus(assertions, status) {
  return assertions.filter((assertion) => assertion.status === status).length;
}

function renderSuite(suiteResult) {
  const suiteName = relativeSuiteName(suiteResult.testFilePath);
  const assertions = Array.isArray(suiteResult.testResults) ? suiteResult.testResults : [];
  const testCount = assertions.length || 1;
  const hasSuiteError = Boolean(suiteResult.testExecError || suiteResult.failureMessage);
  const failures = countByStatus(assertions, "failed");
  const errors = hasSuiteError && assertions.length === 0 ? 1 : 0;
  const skipped = countByStatus(assertions, "pending") + countByStatus(assertions, "todo");
  const runtime = suiteResult.perfStats?.runtime ?? 0;

  const testcases =
    assertions.length > 0
      ? assertions.map((assertion) => renderTestCase(assertion, suiteName))
      : [renderSuiteExecutionError(suiteName, suiteResult)];

  return [
    `  <testsuite name="${escapeXml(suiteName)}" tests="${testCount}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${toSeconds(runtime)}">`,
    ...testcases,
    "  </testsuite>",
  ].join("\n");
}

class JunitReporter {
  constructor(globalConfig, options = {}) {
    this.options = options;
    this.globalConfig = globalConfig;
  }

  onRunComplete(_, results) {
    const outputDirectory = this.options.outputDirectory || "test-results";
    const outputName = this.options.outputName || "junit.xml";
    const outputPath = path.resolve(process.cwd(), outputDirectory, outputName);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const suites = results.testResults.map((suiteResult) => renderSuite(suiteResult));
    const errorCount = results.testResults.reduce((total, suiteResult) => {
      const hasSuiteError = Boolean(suiteResult.testExecError || suiteResult.failureMessage);
      const assertionCount = Array.isArray(suiteResult.testResults)
        ? suiteResult.testResults.length
        : 0;
      return total + (hasSuiteError && assertionCount === 0 ? 1 : 0);
    }, 0);

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuites tests="${results.numTotalTests}" failures="${results.numFailedTests}" errors="${errorCount}" skipped="${results.numPendingTests + results.numTodoTests}" time="${toSeconds(results.testResults.reduce((total, suiteResult) => total + (suiteResult.perfStats?.runtime ?? 0), 0))}">`,
      ...suites,
      "</testsuites>",
      "",
    ].join("\n");

    fs.writeFileSync(outputPath, xml, "utf8");
  }
}

module.exports = JunitReporter;
