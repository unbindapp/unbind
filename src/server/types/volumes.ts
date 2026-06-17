import { PvcScopeSchema } from "@/server/go/client.gen";
import { z } from "zod";

export type TVolumeType = z.infer<typeof PvcScopeSchema>;
