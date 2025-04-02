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
      const enumValues = property.enum.map((val) => JSON.stringify(val)).join(", ");
      return isNullable ? `z.enum([${enumValues}]).nullable()` : `z.enum([${enumValues}])`;
    } else {
      const literals = property.enum.map((val) => `z.literal(${JSON.stringify(val)})`).join(", ");
      return isNullable ? `z.union([${literals}]).nullable()` : `z.union([${literals}])`;
    }
  }

  // Handle union types that include "null"
  if (Array.isArray(property.type)) {
    if (property.type.includes("null")) {
      isNullable = true;
      const nonNullTypes = property.type.filter((t: string) => t !== "null");
      typeValue = nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes;
    }
  }

  // Handle $ref references
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

  // Handle simple types (and objects/arrays) where type is a string
  if (typeof typeValue === "string") {
    let baseType: string;
    switch (typeValue) {
      case "string":
        baseType = property.format === "date-time" ? "z.string().datetime()" : "z.string()";
        break;
      case "number":
      case "integer":
        baseType = "z.number()";
        break;
      case "boolean":
        baseType = "z.boolean()";
        break;
      case "object":
        // If properties are defined, build an object schema inline.
        if (property.properties && Object.keys(property.properties).length > 0) {
          const fields: string[] = [];
          for (const [propName, propSchema] of Object.entries(property.properties)) {
            const fieldType = jsonToZodString({
              property: propSchema,
              currentSchemaName,
              orderMap,
              lazySchemas,
            });
            fields.push(`"${propName}": ${fieldType}`);
          }
          let objectExpr = `z.object({ ${fields.join(", ")} })`;
          if (property.additionalProperties === false) {
            objectExpr += ".strip()";
          } else if (typeof property.additionalProperties === "object") {
            const additionalPropSchema = jsonToZodString({
              property: property.additionalProperties,
              currentSchemaName,
              orderMap,
              lazySchemas,
            });
            objectExpr += `.catchall(${additionalPropSchema})`;
          } else {
            objectExpr += ".passthrough()";
          }
          baseType = objectExpr;
        } else {
          // No defined properties – treat as a record if additionalProperties is provided.
          if (typeof property.additionalProperties === "object") {
            const additionalPropSchema = jsonToZodString({
              property: property.additionalProperties,
              currentSchemaName,
              orderMap,
              lazySchemas,
            });
            baseType = `z.record(${additionalPropSchema})`;
          } else if (property.additionalProperties === false) {
            baseType = "z.object({}).strip()";
          } else {
            baseType = "z.record(z.any())";
          }
        }
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

  // Handle union types when typeValue is an array (after filtering null)
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
          return "z.object({}).passthrough()";
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
          return "z.array(z.any())";
        default:
          return "z.any()";
      }
    });
    const union = `z.union([${types.join(", ")}])`;
    return isNullable ? `${union}.nullable()` : union;
  }

  return isNullable ? "z.any().nullable()" : "z.any()";
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
      return `export const ${schemaName}Schema: z.ZodType<unknown> = ${expr};`;
    } else {
      return `export const ${schemaName}Schema = ${expr};`;
    }
  });

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
    const allStrings = schemaDef.enum.every((val) => typeof val === "string");
    if (allStrings) {
      const enumValues = schemaDef.enum.map((val) => JSON.stringify(val)).join(", ");
      return `z.enum([${enumValues}])`;
    } else {
      const literals = schemaDef.enum.map((val) => `z.literal(${JSON.stringify(val)})`).join(", ");
      return `z.union([${literals}])`;
    }
  }

  if (schemaDef.type === "object") {
    // If properties are defined, build an object with fields.
    if (schemaDef.properties && Object.keys(schemaDef.properties).length > 0) {
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
        objectExpr += ".strip()";
      } else if (typeof schemaDef.additionalProperties === "object") {
        const additionalPropSchema = jsonToZodString({
          property: schemaDef.additionalProperties,
          currentSchemaName: schemaName,
          orderMap,
          lazySchemas,
        });
        objectExpr += `.catchall(${additionalPropSchema})`;
      } else {
        objectExpr += ".passthrough()";
      }
      return objectExpr;
    } else {
      // No defined properties – use a record if an additionalProperties schema is provided.
      if (typeof schemaDef.additionalProperties === "object") {
        const additionalPropSchema = jsonToZodString({
          property: schemaDef.additionalProperties,
          currentSchemaName: schemaName,
          orderMap,
          lazySchemas,
        });
        return `z.record(${additionalPropSchema})`;
      } else if (schemaDef.additionalProperties === false) {
        return "z.object({}).strip()";
      } else {
        return "z.record(z.any())";
      }
    }
  } else if (schemaDef.type === "array" && schemaDef.items) {
    const itemType = jsonToZodString({
      property: schemaDef.items,
      currentSchemaName: schemaName,
      orderMap,
      lazySchemas,
    });
    return `z.array(${itemType})`;
  } else {
    return jsonToZodString({
      property: schemaDef,
      currentSchemaName: schemaName,
      orderMap,
      lazySchemas,
    });
  }
}
