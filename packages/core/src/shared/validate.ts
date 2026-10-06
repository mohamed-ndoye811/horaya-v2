import type { z } from "zod";
import { ValidationError } from "./errors";

/** Valide une entrée de cas d'usage avec Zod et lève une ValidationError lisible. */
export function validate<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw new ValidationError(
    "Données invalides",
    result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  );
}
