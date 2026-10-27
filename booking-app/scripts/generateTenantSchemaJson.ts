/**
 * Regenerate lib/tenant/tenantSchema.schema.json from SchemaContextType.
 *
 * The editor and the API import the committed JSON. Types are erased at
 * runtime, so this script is the only place the TypeScript is read.
 */
import fs from "fs";
import path from "path";
import { createGenerator, type Config } from "ts-json-schema-generator";

export function tenantSchemaGeneratorConfig(root: string): Config {
  return {
    path: path.join(
      root,
      "components/src/client/routes/components/schemaTypes.ts",
    ),
    tsconfig: path.join(root, "tsconfig.json"),
    type: "SchemaContextType",
    schemaId: "https://booking-app/tenant-schema.json",
    additionalProperties: true,
    expose: "export",
    topRef: true,
    jsDoc: "extended",
    sortProps: true,
  };
}

export function generateTenantSchemaDocument(root: string): unknown {
  const config = tenantSchemaGeneratorConfig(root);
  return createGenerator(config).createSchema("SchemaContextType");
}

const entry = process.argv[1] ?? "";
if (entry.includes("generateTenantSchemaJson")) {
  const root = path.resolve(__dirname, "..");
  const schema = generateTenantSchemaDocument(root);
  const out = path.join(root, "lib/tenant/tenantSchema.schema.json");
  fs.writeFileSync(out, `${JSON.stringify(schema, null, 2)}\n`);
}
