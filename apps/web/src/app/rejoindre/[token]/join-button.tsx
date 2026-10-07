"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { joinWithLinkAction } from "./actions";

export function JoinButton({
  token,
  organizationName,
}: {
  token: string;
  organizationName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Button
        size="lg"
        arrow
        pending={pending}
        className="w-full"
        onClick={() =>
          startTransition(async () => {
            const result = await joinWithLinkAction(token);
            if (result?.error) setError(result.error);
          })
        }
      >
        Rejoindre {organizationName}
      </Button>
    </div>
  );
}
