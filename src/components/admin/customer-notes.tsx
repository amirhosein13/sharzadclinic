"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateCustomerNotes } from "@/app/actions/admin";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function CustomerNotes({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = value !== initial;

  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="سوابق، حساسیت‌ها، ترجیحات مشتری..."
      />
      <Button
        size="sm"
        disabled={pending || !dirty}
        onClick={() =>
          startTransition(async () => {
            const result = await updateCustomerNotes(id, value);
            if (result.ok) toast.success(result.message);
            else toast.error(result.message);
          })
        }
      >
        <Save className="size-3.5" />
        {pending ? "در حال ذخیره..." : "ذخیره‌ی یادداشت"}
      </Button>
    </div>
  );
}
