"use client";

import { useTransition } from "react";
import { updateUser } from "@/server/actions/users";
import { Button } from "@/components/ui/button";

interface Props {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}

export function DeactivateUserButton({ userId, isActive, isSelf }: Props) {
  const [isPending, startTransition] = useTransition();

  if (isSelf) return null;

  function toggle() {
    startTransition(async () => {
      await updateUser(userId, { isActive: !isActive });
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 px-2 text-xs ${isActive ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-800"}`}
      onClick={toggle}
      disabled={isPending}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
