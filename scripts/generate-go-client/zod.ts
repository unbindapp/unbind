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

  // Handle enums first, as they take precedence over type checking
  if (Array.isArray(property.enum)) {
    if (property.enum.length === 0) {
      return "z.never()";
    }

    // Check if all enum values are strings
    const allStrings = property.enum.every((val) => typeof val === "string");

    if (allStrings) {
      // Use z.enum for string enums (more type-safe)
      const enumValues = property.enum.map((val) => JSON.stringify(val)).join(", ");
      return isNullable ? `z.enum([${enumValues}]).nullable()` : `z.enum([${enumValues}])`;
    } else {
      // Use z.union of literals for mixed type enums
      const literals = property.enum.map((val) => `z.literal(${JSON.stringify(val)})`).join(", ");
      return isNullable ? `z.union([${literals}]).nullable()` : `z.union([${literals}])`;
    }
  }

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
  // Handle enums first, regardless of the schema type
  if (Array.isArray(schemaDef.enum)) {
    if (schemaDef.enum.length === 0) {
      return "z.never()";
    }

    // Check if all enum values are strings
    const allStrings = schemaDef.enum.every((val) => typeof val === "string");

    if (allStrings) {
      // Use z.enum for string enums (more type-safe)
      const enumValues = schemaDef.enum.map((val) => JSON.stringify(val)).join(", ");
      return `z.enum([${enumValues}])`;
    } else {
      // Use z.union of literals for mixed type enums
      const literals = schemaDef.enum.map((val) => `z.literal(${JSON.stringify(val)})`).join(", ");
      return `z.union([${literals}])`;
    }
  }

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
    // Handle any other type that isn't explicitly handled
    return jsonToZodString({
      property: schemaDef,
      currentSchemaName: schemaName,
      orderMap,
      lazySchemas,
    });
  }
}
