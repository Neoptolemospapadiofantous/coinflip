#!/usr/bin/env tsx
/**
 * Security Audit Script
 * Runs comprehensive security and code quality checks and generates a report
 *
 * Usage:
 *   pnpm audit:security          # Run audit and output to console
 *   pnpm audit:security --json   # Output as JSON
 *   pnpm audit:security --save   # Save report to file
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  message: string;
  details?: string[];
  duration?: number;
}

interface AuditReport {
  timestamp: string;
  version: string;
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
    info: number;
  };
  checks: CheckResult[];
  recommendations: string[];
}

const PROJECT_ROOT = path.resolve(__dirname, '..');

function runCommand(command: string, cwd = PROJECT_ROOT): { success: boolean; output: string; error?: string } {
  try {
    const output = execSync(command, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: output.trim() };
  } catch (err: any) {
    return {
      success: false,
      output: err.stdout?.toString() || '',
      error: err.stderr?.toString() || err.message
    };
  }
}

function searchFiles(pattern: string, globPattern = '**/*.{ts,tsx}', exclude = 'node_modules'): string[] {
  const result = runCommand(`grep -r -l -E "${pattern}" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v .next | grep -v scripts/`);
  if (result.success && result.output) {
    return result.output.split('\n').filter(Boolean);
  }
  return [];
}

function searchContent(pattern: string): { file: string; line: number; content: string }[] {
  const result = runCommand(`grep -r -n -E "${pattern}" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v .next | grep -v scripts/ | head -50`);
  if (result.success && result.output) {
    return result.output.split('\n').filter(Boolean).map(line => {
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (match) {
        return { file: match[1], line: parseInt(match[2]), content: match[3].trim() };
      }
      return { file: '', line: 0, content: line };
    });
  }
  return [];
}

// ============ Security Checks ============

function checkTypeScript(): CheckResult {
  const start = Date.now();
  const result = runCommand('npx tsc --noEmit 2>&1');
  const duration = Date.now() - start;

  if (result.success || result.output === '') {
    return {
      name: 'TypeScript Type Check',
      status: 'pass',
      message: 'No type errors found',
      duration,
    };
  }

  const errors = result.output.split('\n').filter(l => l.includes('error TS'));
  return {
    name: 'TypeScript Type Check',
    status: 'fail',
    message: `Found ${errors.length} type errors`,
    details: errors.slice(0, 10),
    duration,
  };
}

function checkESLint(): CheckResult {
  const start = Date.now();
  const result = runCommand("npx eslint 'app/**/*.{ts,tsx}' 'components/**/*.{ts,tsx}' 'hooks/**/*.{ts,tsx}' 'lib/**/*.{ts,tsx}' 'store/**/*.{ts,tsx}' 2>&1 || true");
  const duration = Date.now() - start;

  const errorMatch = result.output.match(/(\d+) errors?/);
  const warningMatch = result.output.match(/(\d+) warnings?/);

  const errors = errorMatch ? parseInt(errorMatch[1]) : 0;
  const warnings = warningMatch ? parseInt(warningMatch[1]) : 0;

  if (errors === 0 && warnings === 0) {
    return {
      name: 'ESLint Code Quality',
      status: 'pass',
      message: 'No linting issues found',
      duration,
    };
  }

  if (errors === 0) {
    return {
      name: 'ESLint Code Quality',
      status: 'warn',
      message: `${warnings} warnings (0 errors)`,
      duration,
    };
  }

  return {
    name: 'ESLint Code Quality',
    status: 'fail',
    message: `${errors} errors, ${warnings} warnings`,
    details: result.output.split('\n').filter(l => l.includes('error')).slice(0, 10),
    duration,
  };
}

function checkHardcodedSecrets(): CheckResult {
  const start = Date.now();

  // Patterns that might indicate hardcoded secrets
  const patterns = [
    { name: 'API Keys', pattern: '(api[_-]?key|apikey)\\s*[:=]\\s*["\'][^"\']{10,}["\']' },
    { name: 'Passwords', pattern: '(password|passwd|pwd)\\s*[:=]\\s*["\'][^"\']+["\']' },
    { name: 'Private Keys', pattern: '(private[_-]?key|secret[_-]?key)\\s*[:=]\\s*["\'][^"\']+["\']' },
    { name: 'Tokens', pattern: '(token|bearer)\\s*[:=]\\s*["\'][a-zA-Z0-9_-]{20,}["\']' },
  ];

  const findings: string[] = [];

  for (const { name, pattern } of patterns) {
    const matches = searchContent(pattern);
    // Filter out false positives (example values, env references)
    const realMatches = matches.filter(m =>
      !m.content.includes('your_') &&
      !m.content.includes('process.env') &&
      !m.content.includes('example') &&
      !m.file.includes('.example') &&
      !m.file.includes('README') &&
      !m.file.includes('/docs/')
    );

    if (realMatches.length > 0) {
      findings.push(`${name}: ${realMatches.map(m => m.file).join(', ')}`);
    }
  }

  const duration = Date.now() - start;

  if (findings.length === 0) {
    return {
      name: 'Hardcoded Secrets Check',
      status: 'pass',
      message: 'No hardcoded secrets detected',
      duration,
    };
  }

  return {
    name: 'Hardcoded Secrets Check',
    status: 'fail',
    message: `Found ${findings.length} potential secret(s)`,
    details: findings,
    duration,
  };
}

function checkUnsafePatterns(): CheckResult {
  const start = Date.now();

  const patterns = [
    { name: 'eval()', pattern: '\\beval\\s*\\(' },
    { name: 'Function()', pattern: '\\bFunction\\s*\\(' },
    { name: 'innerHTML', pattern: '\\.innerHTML\\s*=' },
    { name: 'outerHTML', pattern: '\\.outerHTML\\s*=' },
    { name: 'document.write', pattern: 'document\\.write\\s*\\(' },
    { name: 'dangerouslySetInnerHTML', pattern: 'dangerouslySetInnerHTML' },
  ];

  const findings: string[] = [];

  for (const { name, pattern } of patterns) {
    const matches = searchContent(pattern);
    // Filter out CSP headers and comments
    const realMatches = matches.filter(m =>
      !m.content.includes('//') &&
      !m.content.includes('script-src') &&
      !m.file.includes('node_modules')
    );

    if (realMatches.length > 0) {
      findings.push(`${name}: ${realMatches.map(m => `${m.file}:${m.line}`).join(', ')}`);
    }
  }

  const duration = Date.now() - start;

  if (findings.length === 0) {
    return {
      name: 'Unsafe Code Patterns',
      status: 'pass',
      message: 'No unsafe patterns detected',
      duration,
    };
  }

  return {
    name: 'Unsafe Code Patterns',
    status: 'fail',
    message: `Found ${findings.length} unsafe pattern(s)`,
    details: findings,
    duration,
  };
}

function checkEnvExposure(): CheckResult {
  const start = Date.now();

  // Check for sensitive env vars that shouldn't be NEXT_PUBLIC_
  const sensitivePatterns = [
    'NEXT_PUBLIC_.*SECRET',
    'NEXT_PUBLIC_.*PASSWORD',
    'NEXT_PUBLIC_.*PRIVATE',
    'NEXT_PUBLIC_.*SERVICE_ROLE',
  ];

  const findings: string[] = [];

  for (const pattern of sensitivePatterns) {
    const matches = searchContent(pattern);
    if (matches.length > 0) {
      findings.push(...matches.map(m => `${m.file}:${m.line} - ${m.content.substring(0, 60)}`));
    }
  }

  const duration = Date.now() - start;

  if (findings.length === 0) {
    return {
      name: 'Environment Variable Exposure',
      status: 'pass',
      message: 'No sensitive env vars exposed to client',
      duration,
    };
  }

  return {
    name: 'Environment Variable Exposure',
    status: 'fail',
    message: `Found ${findings.length} potentially exposed secret(s)`,
    details: findings,
    duration,
  };
}

function checkDependencyAudit(): CheckResult {
  const start = Date.now();
  const result = runCommand('pnpm audit --json 2>&1 || true');
  const duration = Date.now() - start;

  try {
    // Try to parse as JSON
    const lines = result.output.split('\n');
    let auditData: any = null;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.metadata) {
          auditData = parsed;
          break;
        }
      } catch {}
    }

    if (auditData?.metadata?.vulnerabilities) {
      const vulns = auditData.metadata.vulnerabilities;
      const total = vulns.critical + vulns.high + vulns.moderate + vulns.low;

      if (total === 0) {
        return {
          name: 'Dependency Vulnerabilities',
          status: 'pass',
          message: 'No known vulnerabilities',
          duration,
        };
      }

      const details = [];
      if (vulns.critical > 0) details.push(`${vulns.critical} critical`);
      if (vulns.high > 0) details.push(`${vulns.high} high`);
      if (vulns.moderate > 0) details.push(`${vulns.moderate} moderate`);
      if (vulns.low > 0) details.push(`${vulns.low} low`);

      return {
        name: 'Dependency Vulnerabilities',
        status: vulns.critical > 0 || vulns.high > 0 ? 'warn' : 'info',
        message: `${total} vulnerabilities found`,
        details,
        duration,
      };
    }
  } catch {}

  // Fallback: parse text output
  const highMatch = result.output.match(/(\d+)\s+high/i);
  const moderateMatch = result.output.match(/(\d+)\s+moderate/i);
  const lowMatch = result.output.match(/(\d+)\s+low/i);

  const high = highMatch ? parseInt(highMatch[1]) : 0;
  const moderate = moderateMatch ? parseInt(moderateMatch[1]) : 0;
  const low = lowMatch ? parseInt(lowMatch[1]) : 0;
  const total = high + moderate + low;

  if (total === 0) {
    return {
      name: 'Dependency Vulnerabilities',
      status: 'pass',
      message: 'No known vulnerabilities',
      duration,
    };
  }

  return {
    name: 'Dependency Vulnerabilities',
    status: high > 0 ? 'warn' : 'info',
    message: `${total} vulnerabilities (${high} high, ${moderate} moderate, ${low} low)`,
    details: ['Run `pnpm audit` for details'],
    duration,
  };
}

function checkErrorBoundaries(): CheckResult {
  const start = Date.now();

  // Check if ErrorBoundary exists and is used in layout
  const errorBoundaryExists = fs.existsSync(path.join(PROJECT_ROOT, 'components/ErrorBoundary.tsx'));
  const layoutPath = path.join(PROJECT_ROOT, 'app/layout.tsx');
  const layoutContent = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf-8') : '';
  const usesErrorBoundary = layoutContent.includes('ErrorBoundary');

  const duration = Date.now() - start;

  if (errorBoundaryExists && usesErrorBoundary) {
    return {
      name: 'Error Boundaries',
      status: 'pass',
      message: 'Error boundary implemented in root layout',
      duration,
    };
  }

  if (errorBoundaryExists) {
    return {
      name: 'Error Boundaries',
      status: 'warn',
      message: 'Error boundary exists but may not be used in layout',
      duration,
    };
  }

  return {
    name: 'Error Boundaries',
    status: 'fail',
    message: 'No error boundary found',
    details: ['Create components/ErrorBoundary.tsx and wrap app in layout.tsx'],
    duration,
  };
}

function checkInputValidation(): CheckResult {
  const start = Date.now();

  // Check for validation libraries/patterns
  const hasZod = fs.existsSync(path.join(PROJECT_ROOT, 'node_modules/zod'));
  const zodUsage = searchFiles('import.*from.*["\']zod["\']');
  const apiRoutes = searchFiles('export.*async.*function.*(GET|POST|PUT|DELETE|PATCH)');

  const duration = Date.now() - start;

  if (hasZod && zodUsage.length > 0) {
    return {
      name: 'Input Validation',
      status: 'pass',
      message: `Zod validation found in ${zodUsage.length} file(s)`,
      duration,
    };
  }

  if (apiRoutes.length > 0 && zodUsage.length === 0) {
    return {
      name: 'Input Validation',
      status: 'warn',
      message: `${apiRoutes.length} API route(s) found, consider adding input validation`,
      duration,
    };
  }

  return {
    name: 'Input Validation',
    status: 'info',
    message: 'No API routes or validation patterns detected',
    duration,
  };
}

function checkMemoryLeaks(): CheckResult {
  const start = Date.now();

  // Check for common memory leak patterns
  const addEventListeners = searchContent('addEventListener\\(');
  const removeEventListeners = searchContent('removeEventListener\\(');
  const setIntervals = searchContent('setInterval\\(');
  const clearIntervals = searchContent('clearInterval\\(');

  const findings: string[] = [];

  // Simple heuristic: should have roughly matching add/remove
  if (addEventListeners.length > removeEventListeners.length + 2) {
    findings.push(`addEventListener (${addEventListeners.length}) vs removeEventListener (${removeEventListeners.length})`);
  }

  if (setIntervals.length > clearIntervals.length + 2) {
    findings.push(`setInterval (${setIntervals.length}) vs clearInterval (${clearIntervals.length})`);
  }

  const duration = Date.now() - start;

  if (findings.length === 0) {
    return {
      name: 'Memory Leak Patterns',
      status: 'pass',
      message: 'Event listeners and intervals appear properly cleaned up',
      duration,
    };
  }

  return {
    name: 'Memory Leak Patterns',
    status: 'warn',
    message: 'Potential memory leak patterns detected',
    details: findings,
    duration,
  };
}

function checkConsoleStatements(): CheckResult {
  const start = Date.now();

  const consoleLogs = searchContent('console\\.(log|warn|error|debug|info)\\(');
  const duration = Date.now() - start;

  // Filter to only app code (not scripts)
  const appLogs = consoleLogs.filter(m =>
    (m.file.startsWith('./app/') ||
     m.file.startsWith('./components/') ||
     m.file.startsWith('./hooks/') ||
     m.file.startsWith('./lib/') ||
     m.file.startsWith('./store/')) &&
    !m.file.includes('node_modules')
  );

  if (appLogs.length === 0) {
    return {
      name: 'Console Statements',
      status: 'pass',
      message: 'No console statements in application code',
      duration,
    };
  }

  if (appLogs.length < 20) {
    return {
      name: 'Console Statements',
      status: 'info',
      message: `${appLogs.length} console statement(s) in app code (debug logs)`,
      duration,
    };
  }

  return {
    name: 'Console Statements',
    status: 'warn',
    message: `${appLogs.length} console statements - consider removing for production`,
    details: appLogs.slice(0, 5).map(m => `${m.file}:${m.line}`),
    duration,
  };
}

// ============ Report Generation ============

function generateReport(checks: CheckResult[]): AuditReport {
  const summary = {
    total: checks.length,
    passed: checks.filter(c => c.status === 'pass').length,
    warnings: checks.filter(c => c.status === 'warn').length,
    failed: checks.filter(c => c.status === 'fail').length,
    info: checks.filter(c => c.status === 'info').length,
  };

  const recommendations: string[] = [];

  for (const check of checks) {
    if (check.status === 'fail') {
      recommendations.push(`[CRITICAL] Fix ${check.name}: ${check.message}`);
    } else if (check.status === 'warn') {
      recommendations.push(`[WARNING] Review ${check.name}: ${check.message}`);
    }
  }

  // Read package.json for version
  const pkgPath = path.join(PROJECT_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  return {
    timestamp: new Date().toISOString(),
    version: pkg.version || '1.0.0',
    summary,
    checks,
    recommendations,
  };
}

function printReport(report: AuditReport): void {
  console.log('\n');
  console.log(`${colors.bright}${colors.cyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║             SECURITY AUDIT REPORT                            ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();
  console.log(`${colors.gray}Timestamp: ${report.timestamp}${colors.reset}`);
  console.log(`${colors.gray}Version:   ${report.version}${colors.reset}`);
  console.log();

  // Summary
  console.log(`${colors.bright}SUMMARY${colors.reset}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`  ${colors.green}✓ Passed:${colors.reset}   ${report.summary.passed}`);
  console.log(`  ${colors.yellow}⚠ Warnings:${colors.reset} ${report.summary.warnings}`);
  console.log(`  ${colors.red}✗ Failed:${colors.reset}   ${report.summary.failed}`);
  console.log(`  ${colors.blue}ℹ Info:${colors.reset}     ${report.summary.info}`);
  console.log();

  // Detailed checks
  console.log(`${colors.bright}DETAILED RESULTS${colors.reset}`);
  console.log(`${'─'.repeat(50)}`);

  for (const check of report.checks) {
    const icon = {
      pass: `${colors.green}✓${colors.reset}`,
      warn: `${colors.yellow}⚠${colors.reset}`,
      fail: `${colors.red}✗${colors.reset}`,
      info: `${colors.blue}ℹ${colors.reset}`,
    }[check.status];

    const duration = check.duration ? `${colors.gray}(${check.duration}ms)${colors.reset}` : '';

    console.log(`  ${icon} ${check.name} ${duration}`);
    console.log(`    ${colors.gray}${check.message}${colors.reset}`);

    if (check.details && check.details.length > 0) {
      for (const detail of check.details) {
        console.log(`      ${colors.gray}• ${detail}${colors.reset}`);
      }
    }
    console.log();
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log(`${colors.bright}RECOMMENDATIONS${colors.reset}`);
    console.log(`${'─'.repeat(50)}`);
    for (const rec of report.recommendations) {
      if (rec.startsWith('[CRITICAL]')) {
        console.log(`  ${colors.red}${rec}${colors.reset}`);
      } else {
        console.log(`  ${colors.yellow}${rec}${colors.reset}`);
      }
    }
    console.log();
  }

  // Final verdict
  console.log(`${'─'.repeat(50)}`);
  if (report.summary.failed === 0 && report.summary.warnings === 0) {
    console.log(`${colors.green}${colors.bright}✓ ALL CHECKS PASSED - Ready for production${colors.reset}`);
  } else if (report.summary.failed === 0) {
    console.log(`${colors.yellow}${colors.bright}⚠ PASSED WITH WARNINGS - Review before production${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bright}✗ AUDIT FAILED - Fix critical issues before deployment${colors.reset}`);
  }
  console.log();
}

function saveReport(report: AuditReport, format: 'json' | 'md' = 'json'): string {
  const reportsDir = path.join(PROJECT_ROOT, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  if (format === 'json') {
    const filePath = path.join(reportsDir, `security-audit-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    return filePath;
  }

  // Markdown format
  const filePath = path.join(reportsDir, `security-audit-${timestamp}.md`);
  let md = `# Security Audit Report\n\n`;
  md += `**Date:** ${report.timestamp}\n`;
  md += `**Version:** ${report.version}\n\n`;
  md += `## Summary\n\n`;
  md += `| Status | Count |\n|--------|-------|\n`;
  md += `| ✓ Passed | ${report.summary.passed} |\n`;
  md += `| ⚠ Warnings | ${report.summary.warnings} |\n`;
  md += `| ✗ Failed | ${report.summary.failed} |\n`;
  md += `| ℹ Info | ${report.summary.info} |\n\n`;
  md += `## Detailed Results\n\n`;

  for (const check of report.checks) {
    const icon = { pass: '✓', warn: '⚠', fail: '✗', info: 'ℹ' }[check.status];
    md += `### ${icon} ${check.name}\n\n`;
    md += `**Status:** ${check.status.toUpperCase()}\n\n`;
    md += `${check.message}\n\n`;
    if (check.details && check.details.length > 0) {
      md += `**Details:**\n`;
      for (const detail of check.details) {
        md += `- ${detail}\n`;
      }
      md += '\n';
    }
  }

  if (report.recommendations.length > 0) {
    md += `## Recommendations\n\n`;
    for (const rec of report.recommendations) {
      md += `- ${rec}\n`;
    }
  }

  fs.writeFileSync(filePath, md);
  return filePath;
}

// ============ Main ============

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const saveToFile = args.includes('--save');
  const mdFormat = args.includes('--md');

  if (!jsonOutput) {
    console.log(`\n${colors.cyan}Running security audit...${colors.reset}\n`);
  }

  // Run all checks
  const checks: CheckResult[] = [
    checkTypeScript(),
    checkESLint(),
    checkHardcodedSecrets(),
    checkUnsafePatterns(),
    checkEnvExposure(),
    checkDependencyAudit(),
    checkErrorBoundaries(),
    checkInputValidation(),
    checkMemoryLeaks(),
    checkConsoleStatements(),
  ];

  const report = generateReport(checks);

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);

    if (saveToFile) {
      const format = mdFormat ? 'md' : 'json';
      const filePath = saveReport(report, format);
      console.log(`${colors.gray}Report saved to: ${filePath}${colors.reset}\n`);
    }
  }

  // Exit with error code if there are failures
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

main().catch(console.error);
