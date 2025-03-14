export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JSONSchema;
  $ref?: string;
  description?: string;
  [key: string]: any;
}

export interface OpenAPISpec {
  components?: {
    schemas?: Record<string, JSONSchema>;
  };
  paths: Record<string, any>;
}

export interface OperationObject {
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema: JSONSchema }>;
  };
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: JSONSchema;
  }>;
  responses?: Record<
    string,
    {
      content?: Record<string, { schema?: JSONSchema }>;
    }
  >;
  operationId: string;
}
