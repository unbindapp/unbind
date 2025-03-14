import { safeTopologicalSort } from "./helpers";
import { JSONSchema, OpenAPISpec } from "./types";

const lazySchemas = new Set<string>();

export function jsonToZodString({
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

export function generateZodSchemas(openApiSpec: OpenAPISpec): string {
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
    const expr = generateZodExpression({
      schemaName,
      schemaDef: schemas[schemaName],
      orderMap,
    });
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

export function generateZodExpression({
  schemaName,
  schemaDef,
  orderMap,
}: {
  schemaName: string;
  schemaDef: JSONSchema;
  orderMap: Record<string, number>;
}): string {
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
