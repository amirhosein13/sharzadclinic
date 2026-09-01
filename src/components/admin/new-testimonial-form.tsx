"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Star } from "lucide-react";
import { createTestimonial } from "@/app/actions/admin";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/utils";

export function NewTestimonialForm() {
  const [rating, setRating] = useState(5);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formData.set("rating", String(rating));
        startTransition(async () => {
          const result = await createTestimonial(formData);
          if (result.ok) {
            toast.success(result.message);
            formRef.current?.reset();
            setRating(5);
          } else {
            toast.error(result.message);
          }
        });
      }}
      className="space-y-4"
    >
      <Field label="نام مشتری" required>
        <Input name="authorName" placeholder="مریم ر." />
      </Field>

      <Field label="خدمت" hint="اختیاری">
        <Input name="serviceName" placeholder="لیزر موهای زائد" />
      </Field>

      <div>
        <label className="mb-2 block text-sm font-medium">امتیاز</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`امتیاز ${toFa(n)}`}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={
                  n <= rating ? "size-6 fill-gold-400 text-gold-400" : "size-6 text-[color:var(--line)]"
                }
              />
            </button>
          ))}
        </div>
      </div>

      <Field label="متن نظر" required>
        <Textarea name="body" rows={4} placeholder="نظر مشتری را اینجا بنویسید..." />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        <Plus className="size-4" />
        {pending ? "در حال ثبت..." : "ثبت و انتشار نظر"}
      </Button>
    </form>
  );
}
