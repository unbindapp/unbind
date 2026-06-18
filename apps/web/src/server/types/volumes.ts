import { PvcScopeSchema } from "@/server/client.gen";
import { z } from "zod";

export type TVolumeType = z.infer<typeof PvcScopeSchema>;
