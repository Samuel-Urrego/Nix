export interface StackDomain {
  readonly name: string;
  readonly technologies: ReadonlyArray<string>;
  readonly priority: "core" | "important" | "emerging";
}

export const stackInventory: ReadonlyArray<StackDomain> = [
  {
    name: "Python Backend",
    technologies: ["Python 3.13", "uv", "FastAPI", "Pydantic v2", "Pytest", "Ruff", "Mypy"],
    priority: "core"
  },
  {
    name: "Frontend Content and UI",
    technologies: ["Astro", "React", "Vite", "Tailwind CSS"],
    priority: "core"
  },
  {
    name: ".NET Enterprise",
    technologies: [".NET 8", ".NET 10", "C#", "Blazor", "Dapper", "SQL Server", "Stored Procedures"],
    priority: "core"
  },
  {
    name: "AI and Retrieval Apps",
    technologies: ["Pinecone", "OpenAI", "LangChain"],
    priority: "important"
  },
  {
    name: "Protocol and Tools",
    technologies: ["MCP Servers", "Custom Libraries", "CLI Tooling"],
    priority: "core"
  }
];
