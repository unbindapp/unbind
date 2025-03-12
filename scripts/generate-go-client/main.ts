#!/usr/bin/env ts-node
import * as fs from "fs";
import * as path from "path";
import prettier from "prettier";
import * as yaml from "yaml";
import { z } from "zod";

// --------------------
// Type Definitions
// --------------------

interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JSONSchema;
  $ref?: string;
  description?: string;
  [key: string]: any;
}

interface OpenAPISpec {
  components?: {
    schemas?: Record<string, JSONSchema>;
  };
  paths: Record<string, any>;
}

// --------------------
// Zod Schema Generation for Components
// --------------------

// Global set to track schemas that are referenced lazily (forward/circular references).
const lazySchemas = new Set<string>();

/**
 * Recursively traverses a schema to extract all referenced schema names.
 * References are expected to be in the form "#/components/schemas/SomeSchema".
 */
function extractDependencies(schema: JSONSchema): string[] {
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

/**
 * Safely topologically sorts all schemas. Circular dependencies are left as forward references.
 */
function safeTopologicalSort(schemas: Record<string, JSONSchema>): string[] {
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

/**
 * Generates the Zod expression for a given JSON schema.
 * This returns only the right-hand side of the assignment.
 */
function generateZodExpression(
  schemaName: string,
  schemaDef: JSONSchema,
  orderMap: Record<string, number>,
): string {
  if (schemaDef.type === "object" && schemaDef.properties) {
    const fields: string[] = [];
    for (const [propName, propSchema] of Object.entries(schemaDef.properties)) {
      let fieldType = jsonToZodString({
        property: propSchema,
        currentSchemaName: schemaName,
        orderMap,
        lazySchemas,
      });
      const isRequired = schemaDef.required?.includes(propName) ?? false;
      if (!isRequired) {
        fieldType += ".optional()";
      }
      const comment = propSchema.description ? ` // ${propSchema.description}` : "";
      fields.push(`  "${propName}": ${fieldType},${comment}`);
    }
    let objectExpr = `z.object({\n${fields.join("\n")}\n})`;
    if (schemaDef.additionalProperties === false) {
      objectExpr += ".strict()";
    }
    return objectExpr;
  } else if (schemaDef.type === "array" && schemaDef.items) {
    const itemType = jsonToZodString({
      property: schemaDef.items,
      currentSchemaName: schemaName,
      orderMap,
      lazySchemas,
    });
    return `z.array(${itemType})`;
  } else {
    return "z.any() as z.ZodType<unknown>";
  }
}

/**
 * Converts a JSON Schema property to its corresponding Zod expression.
 */
function jsonToZodString({
  property,
  currentSchemaName,
  orderMap,
  lazySchemas,
}: {
  property: JSONSchema;
  currentSchemaName: string;
  orderMap: Record<string, number>;
  lazySchemas: Set<string>;
}): string {
  let isNullable = false;
  let typeValue = property.type;
  if (Array.isArray(property.type)) {
    if (property.type.includes("null")) {
      isNullable = true;
      const nonNullTypes = property.type.filter((t: string) => t !== "null");
      typeValue = nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes;
    }
  }

  if (property.$ref) {
    const refMatch = property.$ref.match(/^#\/components\/schemas\/(.+)$/);
    if (refMatch) {
      const refName = refMatch[1];
      const refSchema = `${refName}Schema`;
      if (orderMap[refName] > orderMap[currentSchemaName]) {
        lazySchemas.add(refName);
        return isNullable ? `z.lazy(() => ${refSchema}).nullable()` : `z.lazy(() => ${refSchema})`;
      }
      return isNullable ? `${refSchema}.nullable()` : refSchema;
    }
  }

  if (typeof typeValue === "string") {
    let baseType: string;
    switch (typeValue) {
      case "string":
        baseType = "z.string()";
        break;
      case "number":
      case "integer":
        baseType = "z.number()";
        break;
      case "boolean":
        baseType = "z.boolean()";
        break;
      case "object":
        baseType = "z.object({})";
        break;
      case "array":
        if (property.items) {
          const itemType = jsonToZodString({
            property: property.items,
            currentSchemaName,
            orderMap,
            lazySchemas,
          });
          baseType = `z.array(${itemType})`;
        } else {
          baseType = "z.array(z.any())";
        }
        break;
      default:
        baseType = "z.any()";
    }
    return isNullable ? `${baseType}.nullable()` : baseType;
  }

  if (Array.isArray(typeValue)) {
    const types = typeValue.map((t: string) => {
      switch (t) {
        case "string":
          return "z.string()";
        case "number":
        case "integer":
          return "z.number()";
        case "boolean":
          return "z.boolean()";
        case "object":
          return "z.object({})";
        case "array":
          if (property.items) {
            const itemType = jsonToZodString({
              property: property.items,
              currentSchemaName,
              orderMap,
              lazySchemas,
            });
            return `z.array(${itemType})`;
          }
          return "z.array(z.any() as z.ZodType<unknown>)";
        default:
          return "z.any() as z.ZodType<unknown>";
      }
    });
    const union = `z.union([${types.join(", ")}])`;
    return isNullable ? `${union}.nullable()` : union;
  }

  return "z.any()";
}

/**
 * Generates Zod schemas for all components defined in the OpenAPI spec.
 */
function generateZodSchemas(openApiSpec: OpenAPISpec): string {
  const schemas = openApiSpec.components?.schemas;
  if (!schemas) {
    throw new Error("No components.schemas found in the OpenAPI spec.");
  }

  const sortedSchemaNames = safeTopologicalSort(schemas);
  const orderMap: Record<string, number> = {};
  sortedSchemaNames.forEach((name, index) => {
    orderMap[name] = index;
  });

  const header = `import { z } from 'zod';\n\n`;

  // For schemas with circular references, use z.lazy properly
  const schemaDeclarations = sortedSchemaNames.map((schemaName) => {
    const expr = generateZodExpression(schemaName, schemas[schemaName], orderMap);
    if (lazySchemas.has(schemaName)) {
      // Create a proper lazy schema declaration with type safety
      return `export const ${schemaName}Schema: z.ZodType<unknown> = ${expr};`;
    } else {
      return `export const ${schemaName}Schema = ${expr};`;
    }
  });

  // After all schemas are declared, add the type declarations
  const interfaceDeclarations = sortedSchemaNames.map((schemaName) => {
    return `export type ${schemaName} = z.infer<typeof ${schemaName}Schema>;`;
  });

  return header + schemaDeclarations.join("\n\n") + "\n\n" + interfaceDeclarations.join("\n");
}

// --------------------
// Client Code Generation (with Inline Input Schemas)
// --------------------

/**
 * Helper to extract a schema name from a $ref.
 */
function getSchemaName(ref: string | undefined): string | null {
  if (!ref) return null;
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Generates an inline JSONSchema for query parameters.
 */
function generateQueryInputSchema(operation: any): JSONSchema | null {
  if (!operation.parameters) return null;
  const queryParams = (operation.parameters as any[]).filter((param) => param.in === "query");
  if (queryParams.length === 0) return null;

  const schema: JSONSchema = {
    type: "object",
    properties: {},
    required: [],
  };

  for (const param of queryParams) {
    if (param.schema) {
      schema.properties![param.name] = { ...param.schema };
      if (param.description) {
        schema.properties![param.name].description = param.description;
      }
      if (param.required) {
        schema.required!.push(param.name);
      }
    }
  }
  return schema;
}

/**
 * --- New Types for Nested Client Generation ---
 */
interface TreeValue {
  endpoints: Record<string, string>; // keyed by HTTP method (lowercase)
  children: Record<string, TreeValue>;
}

/**
 * Recursively generates a string representing an object literal from a nested client tree.
 * In this version endpoints are always grouped by HTTP method.
 */
function generateTreeCode(node: TreeValue, indent: string = "  "): string {
  const parts: string[] = [];
  // Add endpoints under their HTTP method keys.
  for (const method of Object.keys(node.endpoints)) {
    parts.push(`${indent}${method}: ${node.endpoints[method]}`);
  }
  // Add children keys.
  for (const key of Object.keys(node.children)) {
    const childCode = generateTreeCode(node.children[key], indent + "  ");
    parts.push(`${indent}${key}: ${childCode}`);
  }
  return `{\n${parts.join(",\n")}\n${indent.slice(2)}}`;
}

/**
 * Generates client endpoint functions for all paths and builds a nested tree.
 * Endpoints are always inserted under their HTTP method key so that, for instance,
 * a GET endpoint at "/github/repositories" is accessed as client.github.repositories.get.
 *
 * This version separates query parameters and request bodies into separate function parameters.
 */
function generateClientFunctions(openApiSpec: OpenAPISpec): {
  clientTree: TreeValue;
  inlineSchemas: Record<string, JSONSchema>;
} {
  const inlineInputSchemas: Record<string, JSONSchema> = {};
  const clientTree: TreeValue = { endpoints: {}, children: {} };

  // Helper to transform a path segment (e.g. convert "{id}" to "ById").
  function transformSegment(segment: string): string {
    return segment.replace(/\{(\w+)\}/g, (_, p1) => `By${p1[0].toUpperCase()}${p1.slice(1)}`);
  }

  for (const [route, methods] of Object.entries(openApiSpec.paths)) {
    for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
      // Process request body
      let requestSchemaRef: string | null = null;
      let inlineRequestSchema: JSONSchema | null = null;
      if (
        operation.requestBody &&
        operation.requestBody.content &&
        operation.requestBody.content["application/json"]
      ) {
        const reqSchema = operation.requestBody.content["application/json"].schema;
        if (reqSchema && reqSchema.$ref) {
          requestSchemaRef = getSchemaName(reqSchema.$ref);
        } else if (reqSchema) {
          inlineRequestSchema = reqSchema;
        }
      }

      // Process query parameters
      const inlineQuerySchema = generateQueryInputSchema(operation);

      // Prepare separate variables for query and request types.
      let queryType = "";
      let requestType = "";
      let queryParse = "";
      let requestParse = "";

      if (inlineQuerySchema) {
        const querySchemaName = operation.operationId
          ? operation.operationId.replace(/[^a-zA-Z0-9_]/g, "_") + "Query"
          : method.toLowerCase() +
            route
              .replace(/^\//, "")
              .replace(/\{(\w+)\}/g, (_, p1) => `By${p1[0].toUpperCase()}${p1.slice(1)}`) +
            "Query";
        inlineInputSchemas[querySchemaName] = inlineQuerySchema;
        queryType = `z.infer<typeof ${querySchemaName}Schema>`;
        queryParse = `${querySchemaName}Schema.parse(query)`;
      }

      if (inlineRequestSchema) {
        const requestSchemaName = operation.operationId
          ? operation.operationId.replace(/[^a-zA-Z0-9_]/g, "_") + "Input"
          : method.toLowerCase() +
            route
              .replace(/^\//, "")
              .replace(/\{(\w+)\}/g, (_, p1) => `By${p1[0].toUpperCase()}${p1.slice(1)}`) +
            "Input";
        inlineInputSchemas[requestSchemaName] = inlineRequestSchema;
        requestType = `z.infer<typeof ${requestSchemaName}Schema>`;
        requestParse = `${requestSchemaName}Schema.parse(body)`;
      }

      // Determine the function's parameter signature.
      let paramSignature: string;
      if (queryType && requestType) {
        paramSignature = `(query: ${queryType}, body: ${requestType})`;
      } else if (queryType) {
        paramSignature = `(query: ${queryType})`;
      } else if (requestType) {
        paramSignature = `(body: ${requestType})`;
      } else {
        paramSignature = `()`;
      }

      // Process response (only handling $ref cases here)
      let responseSchema: string | null = null;
      const response =
        (operation.responses &&
          (operation.responses["200"] ||
            operation.responses["201"] ||
            operation.responses["default"])) ||
        null;
      if (response && response.content && response.content["application/json"]) {
        responseSchema = getSchemaName(response.content["application/json"].schema?.$ref) || null;
      }

      // Build the function code as an anonymous async arrow function using non-mutative URL creation.
      const functionCode = `
async ${paramSignature} => {
  const baseUrl = \`\${apiUrl}${route}\`;
  ${
    queryType
      ? `const validatedQuery = ${queryParse};
  const queryString = new URLSearchParams(validatedQuery as Record<string,string>).toString();`
      : ""
  }
  const url = ${queryType ? "queryString ? `\${baseUrl}?\${queryString}` : baseUrl" : "baseUrl"};
  const options: RequestInit = {
    method: "${method.toUpperCase()}",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${accessToken}\`
    },
  };
  ${
    requestType
      ? `const validatedBody = ${requestParse};
  options.body = JSON.stringify(validatedBody);`
      : ""
  }
  const response = await fetch(url, options);
  const data = await response.json();
  return ${responseSchema ? `${responseSchema}Schema.parse(data)` : "data"};
}`.trim();

      // Split the route into segments (transforming "{id}" to "ById", etc).
      const segments = route.split("/").filter(Boolean).map(transformSegment);

      // Insert into the client tree.
      let node = clientTree;
      for (const segment of segments) {
        if (!node.children[segment]) {
          node.children[segment] = { endpoints: {}, children: {} };
        }
        node = node.children[segment];
      }
      // Always assign the endpoint under its HTTP method key.
      node.endpoints[method.toLowerCase()] = functionCode;
    }
  }

  return { clientTree, inlineSchemas: inlineInputSchemas };
}

/**
 * Generates code for inline input schemas.
 */
function generateInlineInputSchemas(inlineSchemas: Record<string, JSONSchema>): string {
  return Object.entries(inlineSchemas)
    .map(([name, schema]) => {
      const expr = generateZodExpression(name, schema, {});
      return `export const ${name}Schema = ${expr};`;
    })
    .join("\n\n");
}

// --------------------
// CLI: Read OpenAPI spec, generate schemas + client, and write output file
// --------------------

function displayHelp(): void {
  const helpText = `
Usage: ts-node generateZodSchemas.ts [options] <input-file>
Options:
  -o, --output <output-file>    Specify the output file path (default: ./src/server/go/client.gen.ts)
  -h, --help                    Show this help message.
Description:
  This CLI tool reads an OpenAPI YAML file, generates Zod schemas for both components and inline request/query inputs,
  and creates a fully typed createClient function (using native fetch) based on your spec.
  The generated code is formatted with Prettier and saved to the specified output file.
`;
  console.log(helpText);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    displayHelp();
    process.exit(0);
  }

  let inputFile: string | undefined;
  let outputFile = "./src/server/go/client.gen.ts";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") {
      outputFile = args[i + 1];
      i++;
    } else if (arg === "-i" || arg === "--input") {
      inputFile = args[i + 1];
      i++;
    }
  }

  if (!inputFile) {
    console.error("Error: No input file specified.");
    displayHelp();
    process.exit(1);
  }

  try {
    let fileContent: string;
    if (/^https?:\/\//.test(inputFile)) {
      const response = await fetch(inputFile);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }
      fileContent = await response.text();
    } else {
      const inputPath = path.resolve(process.cwd(), inputFile);
      fileContent = fs.readFileSync(inputPath, "utf8");
    }

    const openApiSpec: OpenAPISpec = yaml.parse(fileContent);

    // Generate schemas for components.
    const componentsSchemasOutput = generateZodSchemas(openApiSpec);
    // Generate client functions and collect inline input schemas.
    const { clientTree, inlineSchemas } = generateClientFunctions(openApiSpec);
    const inlineSchemasOutput = generateInlineInputSchemas(inlineSchemas);
    const clientTreeOutput = generateTreeCode(clientTree);

    const outputContent =
      componentsSchemasOutput +
      "\n\n" +
      inlineSchemasOutput +
      "\n\n" +
      `
export type ClientOptions = {
  accessToken: string;
  apiUrl: string;
};

export function createClient({ accessToken, apiUrl }: ClientOptions) {
  return ${clientTreeOutput};
}
      `;

    const formattedOutput = await prettier.format(outputContent, {
      parser: "typescript",
      singleQuote: true,
      trailingComma: "all",
    });

    const outputPath = path.resolve(process.cwd(), outputFile);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, formattedOutput, "utf8");
    console.log(`Successfully generated Zod schemas and fully typed client in ${outputPath}`);
  } catch (err) {
    console.error("Error processing file:", err);
    process.exit(1);
  }
}

main();
