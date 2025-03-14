import { JSONSchema, OperationObject } from "./types";

export function safeTopologicalSort(schemas: Record<string, JSONSchema>): string[] {
  const sorted: string[] = [];
  const visited: Record<string, boolean> = {};

  function visit(schemaName: string, ancestors: Set<string>): void {
    if (ancestors.has(schemaName)) {
      // Circular dependency detected; skip further recursion.
      return;
    }
    if (!visited[schemaName]) {
      ancestors.add(schemaName);
      const deps = extractDependencies(schemas[schemaName]);
      for (const dep of deps) {
        if (schemas[dep]) {
          visit(dep, ancestors);
        }
      }
      ancestors.delete(schemaName);
      visited[schemaName] = true;
      sorted.push(schemaName);
    }
  }

  for (const schemaName of Object.keys(schemas)) {
    visit(schemaName, new Set<string>());
  }
  return sorted;
}

export function extractDependencies(schema: JSONSchema): string[] {
  const deps = new Set<string>();

  function traverse(obj: any): void {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        traverse(item);
      }
    } else if (typeof obj === "object" && obj !== null) {
      if (obj.$ref && typeof obj.$ref === "string") {
        const match = obj.$ref.match(/^#\/components\/schemas\/(.+)$/);
        if (match) {
          deps.add(match[1]);
        }
      }
      for (const key in obj) {
        traverse(obj[key]);
      }
    }
  }

  traverse(schema);
  return Array.from(deps);
}

export function getSchemaName(ref: string | undefined): string | null {
  if (!ref) return null;
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  return match ? match[1] : null;
}

export function displayHelp(): void {
  const helpText = `
Usage: ts-node generateZodSchemas.ts [options] <input-file>
Options:
  -o, --output <output-file>    Specify the output file path (default: ./src/server/go/client.gen.ts)
  -h, --help                    Show this help message.
Description:
  This CLI tool reads an OpenAPI YAML file, generates Zod schemas for both components and inline request/query inputs,
  and creates a fluent, fully typed API client based on your spec.
  
  Features:
  - Path parameters become function calls in the client chain
  - e.g., /github/installation/{installation_id}/organizations becomes client.github.installation.installationId("123").organizations()
  - Generated code is formatted with Prettier and saved to the specified output file.
`;
  console.log(helpText);
}

export function toCamelCase(str: string): string {
  if (!str) return "";

  // First make sure we have a string
  const safeStr = String(str);

  // Handle kebab-case and snake_case
  return safeStr.replace(/[-_]([a-z])/gi, (_, char) => {
    return char ? char.toUpperCase() : "";
  });
}

export function createSchemaName(
  operation: OperationObject,
  method: string,
  route: string,
  type: string,
): string {
  return operation.operationId
    ? `${operation.operationId.replace(/[^a-zA-Z0-9_]/g, "_")}${type}`
    : `${method.toLowerCase()}${route
        .replace(/^\//, "")
        .replace(/\{(\w+)\}/g, (_, p1) => `By${p1[0].toUpperCase()}${p1.slice(1)}`)}${type}`;
}
