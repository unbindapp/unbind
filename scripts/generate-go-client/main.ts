#!/usr/bin/env ts-node
import * as fs from "fs";
import * as path from "path";
import prettier from "prettier";
import * as yaml from "yaml";
import { JSONSchema, OpenAPISpec, OperationObject } from "./types";
import { generateZodExpression, generateZodSchemas } from "./zod";
import { createSchemaName, displayHelp, getSchemaName, toCamelCase } from "./helpers";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

interface Segment {
  type: "static" | "parameter";
  value: string;
  originalValue?: string;
}

interface TreeNode {
  handler?: string; // Endpoint function code for this route
  children: Record<string, TreeNode>;
  isParam: boolean;
}

// ---------------------------------------------------------------------
// Helper functions for processing OpenAPI schema components
// ---------------------------------------------------------------------

/**
 * Process request body schema from operation
 */
function processRequestBody(operation: OperationObject): {
  schemaRef: string | null;
  inlineSchema: JSONSchema | null;
  isRequired: boolean;
} {
  const result = {
    schemaRef: null as string | null,
    inlineSchema: null as JSONSchema | null,
    isRequired: false,
  };

  if (!operation.requestBody) {
    return result;
  }

  // Check if the request body is required
  result.isRequired = operation.requestBody.required === true;

  // Get content schema
  if (
    operation.requestBody.content &&
    operation.requestBody.content["application/json"] &&
    operation.requestBody.content["application/json"].schema
  ) {
    const schema = operation.requestBody.content["application/json"].schema;

    // Check if it's a reference to an existing schema
    if (schema.$ref) {
      result.schemaRef = getSchemaName(schema.$ref);
    } else {
      // Or it's an inline schema
      result.inlineSchema = schema;
    }
  }

  return result;
}

/**
 * Generates an inline JSONSchema for query parameters.
 */
function generateQueryInputSchema(operation: any): {
  schema: JSONSchema | null;
  hasRequiredParams: boolean;
} {
  if (!operation.parameters) {
    return { schema: null, hasRequiredParams: false };
  }

  const queryParams = (operation.parameters as any[]).filter((param) => param.in === "query");
  if (queryParams.length === 0) {
    return { schema: null, hasRequiredParams: false };
  }

  const schema: JSONSchema = {
    type: "object",
    properties: {},
    required: [],
  };

  let hasRequiredParams = false;

  for (const param of queryParams) {
    if (param.schema) {
      schema.properties![param.name] = { ...param.schema };
      if (param.description) {
        schema.properties![param.name].description = param.description;
      }
      if (param.required) {
        schema.required!.push(param.name);
        hasRequiredParams = true;
      }
    }
  }

  return { schema, hasRequiredParams };
}

/**
 * Parse a route into segments, identifying parameters and converting to camelCase.
 */
function parseRoute(route: string): Segment[] {
  const safeRoute = route || "";
  const parts = safeRoute.split(/(\{[^}]+\})/);
  const segments: Segment[] = [];

  parts.forEach((part) => {
    if (!part) return; // Skip empty parts

    if (part.startsWith("{") && part.endsWith("}")) {
      // This is a parameter
      const paramName = part.substring(1, part.length - 1);
      if (paramName) {
        segments.push({
          type: "parameter",
          value: toCamelCase(paramName),
          originalValue: paramName,
        });
      }
    } else {
      // This is a static path; split by slashes and add each non-empty segment
      part
        .split("/")
        .filter(Boolean)
        .forEach((segment) => {
          segments.push({
            type: "static",
            value: segment,
          });
        });
    }
  });

  return segments;
}

// ---------------------------------------------------------------------
// Tree Code Generation
// ---------------------------------------------------------------------

/**
 * Recursively generates a string representing the client tree.
 * If a node has a handler (an endpoint function) and also children,
 * the function is augmented with the children as properties.
 */
function generateTreeCode(node: TreeNode, indent: string = "  "): string {
  const childParts: string[] = [];

  for (const key of Object.keys(node.children)) {
    const childNode = node.children[key];
    const childCode = generateTreeCode(childNode, indent + "  ");
    // Convert property name to camelCase if it contains hyphens
    const safeKey = propertyNameToCamelCase(key);

    if (childNode.isParam) {
      childParts.push(`${indent}${safeKey}: (${key}: string | number | boolean) => (${childCode})`);
    } else {
      childParts.push(`${indent}${safeKey}: ${childCode}`);
    }
  }

  if (node.handler) {
    if (childParts.length > 0) {
      return `Object.assign(${node.handler}, {\n${childParts.join(",\n")}\n${indent}})`;
    } else {
      return node.handler;
    }
  } else {
    return `{\n${childParts.join(",\n")}\n${indent.slice(2)}}`;
  }
}

/**
 * Convert kebab-case to camelCase for property names
 */
function propertyNameToCamelCase(name: string): string {
  // Handle kebab-case by converting to camelCase
  if (name.includes("-")) {
    return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }
  return name;
}

// ---------------------------------------------------------------------
// Endpoint Function Generation
// ---------------------------------------------------------------------

/**
 * Generates the code for an API endpoint function, handling path parameters.
 * The function always takes at most two inputs: a combined "params" object
 * (merging query and body parameters) and fetchOptions.
 */
/**
 * Generates the code for an API endpoint function, handling path parameters.
 * The function always takes at most two inputs: a combined "params" object
 * (merging query and body parameters) and fetchOptions.
 * If no params are required, the signature will be: (params?: undefined, fetchOptions?: RequestInit)
 */
function generateEndpointFunction(
  route: string,
  method: string,
  operation: OperationObject,
  segments: Segment[],
  inlineInputSchemas: Record<string, JSONSchema>,
): string {
  // Process request body
  const requestBody = processRequestBody(operation);

  // Process query parameters
  const { schema: inlineQuerySchema, hasRequiredParams: hasRequiredQueryParams } =
    generateQueryInputSchema(operation);

  let queryType = "";
  let requestType = "";
  let queryParse = "";
  let requestParse = "";
  let querySchemaName = "";
  let requestSchemaName = "";
  let queryKeysCode = "";

  // Handle query parameters
  if (inlineQuerySchema) {
    querySchemaName = createSchemaName(operation, method, route, "Query");
    inlineInputSchemas[querySchemaName] = inlineQuerySchema;
    queryType = `z.infer<typeof ${querySchemaName}Schema>`;
    const queryKeys = Object.keys(inlineQuerySchema.properties || {});
    queryKeysCode = JSON.stringify(queryKeys);
    queryParse = `${querySchemaName}Schema.parse(params)`;
  }

  // Handle request body
  if (requestBody.schemaRef) {
    requestType = requestBody.schemaRef;
    requestParse = `${requestBody.schemaRef}Schema.parse(params)`;
  } else if (requestBody.inlineSchema) {
    requestSchemaName = createSchemaName(operation, method, route, "Input");
    inlineInputSchemas[requestSchemaName] = requestBody.inlineSchema;
    requestType = `z.infer<typeof ${requestSchemaName}Schema>`;
    requestParse = `${requestSchemaName}Schema.parse(params)`;
  }

  // Determine combined parameter type
  let combinedType = "";
  if (queryType && requestType) {
    combinedType = `${queryType} & ${requestType}`;
  } else if (queryType) {
    combinedType = queryType;
  } else if (requestType) {
    combinedType = requestType;
  } else {
    combinedType = "{}";
  }

  // Create the proper function parameter signature.
  // If no parameters are required, use "params?: undefined"
  let paramSignature: string;
  if (combinedType === "{}") {
    paramSignature = `(params?: undefined, fetchOptions?: RequestInit)`;
  } else {
    paramSignature = `(params: ${combinedType}, fetchOptions?: RequestInit)`;
  }

  // Process response (handle references and inline schemas)
  let responseSchema: string | null = null;
  let responseType: string | null = null;

  const response =
    (operation.responses &&
      (operation.responses["200"] ||
        operation.responses["201"] ||
        operation.responses["default"])) ||
    null;

  if (response && response.content && response.content["application/json"]) {
    const responseContent = response.content["application/json"];
    if (responseContent.schema) {
      if (responseContent.schema.$ref) {
        responseSchema = getSchemaName(responseContent.schema.$ref);
        if (responseSchema) {
          responseType = `${responseSchema}`;
        }
      } else {
        // Handle inline response schema
        const responseSchemaName = createSchemaName(operation, method, route, "Response");
        inlineInputSchemas[responseSchemaName] = responseContent.schema;
        responseSchema = responseSchemaName;
        responseType = `z.infer<typeof ${responseSchemaName}Schema>`;
      }
    }
  }

  // Create a template string to replace path parameters
  let urlTemplate = route;
  segments.forEach((segment) => {
    if (segment.type === "parameter" && segment.originalValue) {
      urlTemplate = urlTemplate.replace(`{${segment.originalValue}}`, `\${${segment.value}}`);
    }
  });

  // Build the endpoint function code as an anonymous async arrow function
  const functionCode = `
async ${paramSignature}${responseType ? `: Promise<${responseType}>` : ""} => {
  try {
    if (!apiUrl || typeof apiUrl !== 'string') {
      throw new Error('API URL is undefined or not a string');
    }
    const url = new URL(\`\${apiUrl}${urlTemplate}\`);
    ${
      queryType
        ? `const validatedQuery = ${queryParse};
    const queryKeys = ${queryKeysCode};
    queryKeys.forEach((key) => {
      const value = validatedQuery[key as keyof typeof validatedQuery];
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });`
        : ""
    }
    const options: RequestInit = {
      method: "${method.toUpperCase()}",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${accessToken}\`
      },
      ...fetchOptions
    };
    ${
      requestType
        ? `const validatedBody = ${requestParse};
    options.body = JSON.stringify(validatedBody);`
        : ""
    }
    const response = await fetch(url.toString(), options);
    if (!response.ok) {
      console.log(\`GO API request failed with status \${response.status}: \${response.statusText}\`);
      const data = await response.json();
      console.log(\`GO API request error\`, data);
      console.log(\`Request URL is:\`, url.toString());
      ${requestType ? `console.log(\`Request body is:\`, validatedBody);` : ""}
      throw new Error(\`GO API request failed with status \${response.status}: \${response.statusText}\`);
    }
    const data = await response.json();
    ${
      responseSchema
        ? `const { data: parsedData, error } = ${responseSchema}Schema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;`
        : "return data;"
    }
  } catch (error) {
    console.error('Error in API request:', error);
    throw error;
  }
}`.trim();

  return functionCode;
}

// ---------------------------------------------------------------------
// Client Functions Generation
// ---------------------------------------------------------------------

/**
 * Generates client endpoint functions for all paths and builds a nested tree.
 * Instead of grouping endpoints by HTTP method, each final node is assigned a "handler".
 */
function generateClientFunctions(openApiSpec: OpenAPISpec): {
  clientTree: TreeNode;
  inlineSchemas: Record<string, JSONSchema>;
} {
  const inlineInputSchemas: Record<string, JSONSchema> = {};
  const clientTree: TreeNode = { children: {}, isParam: false };

  for (const [route, methods] of Object.entries(openApiSpec.paths || {})) {
    if (!methods || typeof methods !== "object") {
      console.warn(`Skipping route ${route}: methods is not an object`);
      continue;
    }

    // Parse the route into segments
    const segments = parseRoute(route);

    for (const [method, operation] of Object.entries(methods)) {
      if (!operation || typeof operation !== "object") {
        console.warn(`Skipping ${method} operation for route ${route}: operation is not an object`);
        continue;
      }
      if (
        !["get", "post", "put", "delete", "patch", "options", "head"].includes(
          String(method).toLowerCase(),
        )
      ) {
        continue;
      }

      // Generate the endpoint function
      const functionCode = generateEndpointFunction(
        route,
        method.toLowerCase(),
        operation as OperationObject,
        segments,
        inlineInputSchemas,
      );

      // Insert into the client tree
      let currentNode = clientTree;
      for (const segment of segments) {
        const segmentKey = segment.value;
        if (!currentNode.children[segmentKey]) {
          currentNode.children[segmentKey] = {
            children: {},
            isParam: segment.type === "parameter",
          };
        }
        currentNode = currentNode.children[segmentKey];
      }
      // Assign the handler function to the final node.
      currentNode.handler = functionCode;
    }
  }

  return { clientTree, inlineSchemas: inlineInputSchemas };
}

// ---------------------------------------------------------------------
// Inline Schema Generation
// ---------------------------------------------------------------------

/**
 * Generates code for inline input schemas.
 */
function generateInlineInputSchemas(inlineSchemas: Record<string, JSONSchema>): string {
  if (!inlineSchemas || typeof inlineSchemas !== "object") {
    console.warn("Warning: inlineSchemas is not an object. Returning empty string.");
    return "";
  }

  return Object.entries(inlineSchemas)
    .map(([name, schema]) => {
      try {
        if (!name || !schema) {
          console.warn(`Warning: Invalid schema entry: ${name}`);
          return "";
        }
        const expr = generateZodExpression({
          schemaName: name,
          schemaDef: schema,
          orderMap: {},
        });
        return `export const ${name}Schema = ${expr};`;
      } catch (error) {
        console.error(`Error generating schema for ${name}:`, error);
        return `// Error generating schema for ${name}`;
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------
// CLI: Read OpenAPI spec, generate schemas + client, and write output file
// ---------------------------------------------------------------------

async function main() {
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
    } else if (!inputFile && !arg.startsWith("-")) {
      inputFile = arg;
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
      printWidth: 100,
    });

    const outputPath = path.resolve(process.cwd(), outputFile);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, formattedOutput, "utf8");
    console.log(`Successfully generated Zod schemas and fluent API client in ${outputPath}`);
  } catch (err) {
    console.error("Error processing file:", err);
    process.exit(1);
  }
}

main();
