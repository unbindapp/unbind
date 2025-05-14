import { z } from 'zod';

export const AvailableDatabaseEnum = z.enum([
  'postgres',
  'redis',
  'mysql',
  'mongodb',
  'clickhouse',
]);
export type TAvailableDatabase = z.infer<typeof AvailableDatabaseEnum>;
