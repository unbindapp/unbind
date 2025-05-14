export function createDatabasesEnum(databases: string[]) {
  const databasesString = databases.map((d) => `"${d}"`).join(", ");
  return `
    export const AvailableDatabaseEnum = z.enum([${databasesString}]);
    export type TAvailableDatabase = z.infer<typeof AvailableDatabaseEnum>;
  `;
}
