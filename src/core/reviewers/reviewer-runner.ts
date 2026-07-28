import type { ReviewerSpec } from "../contracts/reviewer-spec.js";
import type { RepoScanResult } from "../stack/repo-scanner.js";

export type ReviewSeverity = "critical" | "warning" | "suggestion";
export type ReviewVerdict = "pass" | "pass-with-warnings" | "fail";

export interface ReviewFinding {
  readonly severity: ReviewSeverity;
  readonly message: string;
}

export interface ReviewReport {
  readonly reviewer: ReviewerSpec;
  readonly verdict: ReviewVerdict;
  readonly findings: ReadonlyArray<ReviewFinding>;
}

export function runReviewers(
  reviewers: ReadonlyArray<ReviewerSpec>,
  scan: RepoScanResult
): ReadonlyArray<ReviewReport> {
  const applicable = reviewers.filter((reviewer) => isReviewerApplicable(reviewer, scan.tags));

  return applicable.map((reviewer) => {
    const findings = getFindingsForReviewer(reviewer, scan);
    const verdict = inferVerdict(findings);

    return {
      reviewer,
      verdict,
      findings
    };
  });
}

function isReviewerApplicable(
  reviewer: ReviewerSpec,
  tags: ReadonlyArray<string>
): boolean {
  if (reviewer.id === "architecture-selector") {
    return true;
  }

  return reviewer.appliesTo.some((tag) => tags.includes(tag));
}

function getFindingsForReviewer(
  reviewer: ReviewerSpec,
  scan: RepoScanResult
): ReadonlyArray<ReviewFinding> {
  switch (reviewer.id) {
    case "architecture-selector":
      return architectureSelectorFindings(scan);
    case "clean-architecture":
      return cleanArchitectureFindings(scan);
    case "fastapi-backend":
      return fastApiFindings(scan);
    case "sql-dapper-sp":
      return sqlDapperFindings(scan);
    case "mcp-safety":
      return mcpSafetyFindings(scan);
    default:
      return [
        {
          severity: "suggestion",
          message: "No executable review rule exists yet for this reviewer."
        }
      ];
  }
}

function architectureSelectorFindings(scan: RepoScanResult): ReadonlyArray<ReviewFinding> {
  const findings: ReviewFinding[] = [];

  if (!scan.tags.includes("nix")) {
    findings.push({
      severity: "suggestion",
      message: "Add a nix.config.json file so Nix can tune reviewer and architecture behavior per repository."
    });
  }

  if (scan.tags.includes("python") && scan.tags.includes(".net")) {
    findings.push({
      severity: "warning",
      message: "This repository spans multiple backend ecosystems. Be explicit about architectural boundaries so the project does not drift into accidental complexity."
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "suggestion",
      message: "Architecture signals look coherent so far. Keep the simplest structure that matches the real problem."
    });
  }

  return findings;
}

function cleanArchitectureFindings(scan: RepoScanResult): ReadonlyArray<ReviewFinding> {
  const findings: ReviewFinding[] = [];

  if (!scan.tags.includes("backend")) {
    findings.push({
      severity: "suggestion",
      message: "Clean Architecture is usually unnecessary unless this repository has meaningful backend or enterprise domain pressure."
    });
  }

  if (scan.tags.includes("backend") && !scan.tags.includes("tests")) {
    findings.push({
      severity: "warning",
      message: "If you choose Clean Architecture, add clear tests around use cases and boundaries. Heavy structure without verification is expensive theater."
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "suggestion",
      message: "Only keep Clean Architecture if the domain truly benefits from stronger boundary discipline."
    });
  }

  return findings;
}

function fastApiFindings(scan: RepoScanResult): ReadonlyArray<ReviewFinding> {
  const findings: ReviewFinding[] = [];

  if (!scan.tags.includes("tests")) {
    findings.push({
      severity: "warning",
      message: "FastAPI projects should expose route and dependency behavior through tests. No root tests directory was detected."
    });
  }

  findings.push({
    severity: "suggestion",
    message: "Keep request/response contracts, settings, and security dependencies explicit. Avoid letting route files become business-logic dumping grounds."
  });

  return findings;
}

function sqlDapperFindings(scan: RepoScanResult): ReadonlyArray<ReviewFinding> {
  return [
    {
      severity: "suggestion",
      message: "Validate parameterized access, stored procedure naming discipline, and mapping clarity so Dapper does not hide data shape problems."
    }
  ];
}

function mcpSafetyFindings(scan: RepoScanResult): ReadonlyArray<ReviewFinding> {
  return [
    {
      severity: "suggestion",
      message: "Keep MCP tools narrow, validated, and explicit about read/write boundaries. Tool sprawl is a fast path to unsafe agent behavior."
    }
  ];
}

function inferVerdict(findings: ReadonlyArray<ReviewFinding>): ReviewVerdict {
  if (findings.some((finding) => finding.severity === "critical")) {
    return "fail";
  }

  if (findings.some((finding) => finding.severity === "warning")) {
    return "pass-with-warnings";
  }

  return "pass";
}
