import type { ReviewerSpec } from "../contracts/reviewer-spec.js";

export const builtinReviewers: ReadonlyArray<ReviewerSpec> = [
  {
    id: "architecture-selector",
    name: "Architecture Selector Reviewer",
    category: "architecture",
    appliesTo: ["general", "startup", "enterprise", "internal-tools"],
    goal: "Check whether the chosen architecture fits the real project context.",
    signals: [
      {
        name: "Context fit",
        description: "The architecture should match scale, constraints, and delivery pressure."
      },
      {
        name: "Complexity pressure",
        description: "Avoid architecture that adds layers without solving a real problem."
      }
    ],
    checks: [
      {
        id: "fit-problem-shape",
        title: "Fit the problem shape",
        description: "Verify the architecture is appropriate for the domain, team size, and system complexity."
      },
      {
        id: "reject-ceremony",
        title: "Reject empty ceremony",
        description: "Flag unnecessary layers, abstractions, or patterns that do not improve maintainability."
      }
    ]
  },
  {
    id: "clean-architecture",
    name: "Clean Architecture Reviewer",
    category: "architecture",
    appliesTo: [".net", "python", "backend"],
    goal: "Validate dependency direction, boundaries, and use-case discipline.",
    signals: [
      {
        name: "Boundary clarity",
        description: "Core rules should remain independent from infrastructure details."
      },
      {
        name: "Dependency direction",
        description: "Dependencies should point inward toward application and domain rules."
      }
    ],
    checks: [
      {
        id: "boundary-consistency",
        title: "Boundary consistency",
        description: "Check whether domain, application, and infrastructure boundaries are explicit and respected."
      },
      {
        id: "inward-dependencies",
        title: "Inward dependencies",
        description: "Verify domain and use-case code do not depend on frameworks, transport, or storage details."
      }
    ]
  },
  {
    id: "fastapi-backend",
    name: "FastAPI Backend Reviewer",
    category: "technology",
    appliesTo: ["python", "fastapi"],
    goal: "Validate API design, module shape, validation boundaries, and operational conventions.",
    signals: [
      {
        name: "Explicit contracts",
        description: "Request/response models and settings should be explicit and typed."
      },
      {
        name: "Operational clarity",
        description: "Security, validation, and observability should not be accidental."
      }
    ],
    checks: [
      {
        id: "api-contracts",
        title: "API contracts",
        description: "Ensure routes, schemas, dependencies, and validation boundaries are coherent."
      },
      {
        id: "module-shape",
        title: "Module shape",
        description: "Check whether backend modules are organized around clear domain or feature boundaries."
      }
    ]
  },
  {
    id: "sql-dapper-sp",
    name: "SQL Server / Dapper / Stored Procedure Reviewer",
    category: "pattern",
    appliesTo: ["csharp", "sqlserver", "dapper"],
    goal: "Validate mapping discipline, query safety, and stored procedure usage.",
    signals: [
      {
        name: "Safe data access",
        description: "Data access should avoid unsafe SQL composition and unclear mapping rules."
      },
      {
        name: "Stored procedure discipline",
        description: "Procedure usage should remain explicit, maintainable, and testable."
      }
    ],
    checks: [
      {
        id: "parameter-safety",
        title: "Parameter safety",
        description: "Verify SQL parameters and stored procedure calls are explicit and safe."
      },
      {
        id: "mapping-clarity",
        title: "Mapping clarity",
        description: "Check that Dapper mapping stays intentional and does not hide data shape problems."
      }
    ]
  },
  {
    id: "mcp-safety",
    name: "MCP Safety Reviewer",
    category: "technology",
    appliesTo: ["mcp", "ai-agents", "tools"],
    goal: "Validate tool exposure, safety boundaries, and protocol discipline.",
    signals: [
      {
        name: "Tool boundaries",
        description: "Capabilities should be deliberately exposed and constrained."
      },
      {
        name: "Execution safety",
        description: "Read/write rules and validation should be explicit."
      }
    ],
    checks: [
      {
        id: "tool-scope",
        title: "Tool scope",
        description: "Ensure each tool has a narrow, justified responsibility."
      },
      {
        id: "safety-guards",
        title: "Safety guards",
        description: "Verify read/write constraints, validation, and risk controls exist where needed."
      }
    ]
  }
];
