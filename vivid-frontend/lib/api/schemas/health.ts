import { z } from "zod";

// Mirrors GET /api/health in vivid-backend, which answers {"status": "ok"}.
export const healthSchema = z.object({
  status: z.string(),
});

export type Health = z.infer<typeof healthSchema>;
