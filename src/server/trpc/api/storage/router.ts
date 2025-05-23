import { s3Router } from "@/server/trpc/api/storage/s3/router";
import { volumesRouter } from "@/server/trpc/api/storage/volumes/router";
import { createTRPCRouter } from "@/server/trpc/setup/trpc";

export const storageRouter = createTRPCRouter({
  s3: s3Router,
  volumes: volumesRouter,
});
