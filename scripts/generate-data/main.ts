import * as fs from "fs";
import * as path from "path";
import prettier from "prettier";
import { z } from "zod";
import { createDatabasesEnum } from "./zod";

const customServiceDefinitionsEndpoint =
  "https://raw.githubusercontent.com/unbindapp/unbind-custom-service-definitions/refs/heads/master/index.json";

const CustomServiceDefinitionsResultSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string(),
      templates: z.array(z.string()),
    }),
  ),
});

async function main() {
  const args = process.argv.slice(2);

  let outputFile = "./src/server/go/data.gen.ts";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") {
      outputFile = args[i + 1];
      i++;
    }
  }

  try {
    const res = await fetch(customServiceDefinitionsEndpoint);
    if (!res.ok) {
      throw new Error(`Failed to fetch data from: ${customServiceDefinitionsEndpoint}`);
    }
    const jsonData = await res.json();
    const { data, error } = CustomServiceDefinitionsResultSchema.safeParse(jsonData);

    if (error) {
      console.error("Error parsing JSON data:", error);
      process.exit(1);
    }

    const databaseObjects = data.categories.find((category) => category.name === "databases");

    if (!databaseObjects) {
      console.error("No databases category found in the data.");
      process.exit(1);
    }

    const databasesEnum = createDatabasesEnum(databaseObjects.templates);

    const outputContent = `
      import { z } from "zod";
      
      ${databasesEnum}
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
    console.log(`Successfully generated data: ${outputPath}`);
  } catch (err) {
    console.error("Error processing file:", err);
    process.exit(1);
  }
}

main();
