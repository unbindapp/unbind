"use client";

import ErrorLine from "@/components/error-line";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { CheckIcon } from "lucide-react";
import { z } from "zod";

type TProps = {
  className?: string;
};

const WebhookIdEnum = z.enum([
  "service.created",
  "service.updated",
  "service.deleted",
  "deployment.queued",
  "deployment.building",
  "deployment.succeeded",
  "deployment.failed",
  "deployment.cancelled",
]);

type TWebhookId = z.infer<typeof WebhookIdEnum>;

type TWebhookOption = {
  id: TWebhookId;
  title: string;
};

type TWebhookGroup = {
  title: string;
  options: TWebhookOption[];
};

const webhookGroups: TWebhookGroup[] = [
  {
    title: "Service",
    options: [
      { id: "service.created", title: "Service Created" },
      { id: "service.updated", title: "Service Updated" },
      { id: "service.deleted", title: "Service Deleted" },
    ],
  },
  {
    title: "Deployment",
    options: [
      { id: "deployment.queued", title: "Deployment Queued" },
      { id: "deployment.building", title: "Deployment Building" },
      { id: "deployment.succeeded", title: "Deployment Succeeded" },
      { id: "deployment.failed", title: "Deployment Failed" },
      { id: "deployment.cancelled", title: "Deployment Cancelled" },
    ],
  },
];

export default function AddWebhookForm({ className }: TProps) {
  const form = useAppForm({
    defaultValues: {
      selectedIds: new Set<TWebhookId>(),
      url: "",
    },
    validators: {
      onChange: z.object({
        selectedIds: z.set(WebhookIdEnum).min(1, "Select at least one event."),
        url: z.string().url("Invalid URL."),
      }),
    },
    onSubmit: async ({ formApi, value }) => {
      const selectedIds = value.selectedIds;
      formApi.reset();
      formApi.setFieldValue("selectedIds", selectedIds);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className={cn("flex w-full flex-col rounded-lg border", className)}
    >
      <div className="flex w-full flex-col px-4 pt-3 pb-4 sm:px-6 sm:pt-4 sm:pb-6">
        <h2 className="w-full text-lg leading-tight font-semibold">Events</h2>
        <p className="text-muted-foreground mt-1 leading-tight">
          Select the events that will call the webhook.
        </p>
        <div className="mt-4 flex w-full flex-col">
          <div className="flex w-full flex-wrap gap-6 sm:gap-8">
            {webhookGroups.map((group) => (
              <div key={group.title} className="flex w-full flex-col sm:w-[calc((100%-2rem)/2)]">
                <h3 className="text-muted-foreground text-sm leading-tight font-medium">
                  {group.title}
                </h3>
                <div className="-mx-3 mt-1.5 flex w-[calc(100%+1.5rem)] flex-col items-start justify-start">
                  {group.options.map((option) => (
                    <form.AppField
                      key={option.id}
                      name="selectedIds"
                      children={(field) => (
                        <button
                          type="button"
                          key={option.id}
                          data-checked={field.state.value.has(option.id) ? true : undefined}
                          onClick={() =>
                            field.handleChange((prev) => {
                              const newSet = new Set(prev);
                              if (prev.has(option.id)) {
                                newSet.delete(option.id);
                              } else {
                                newSet.add(option.id);
                              }
                              return newSet;
                            })
                          }
                          className="group/checkbox has-hover:hover:bg-border active:bg-border flex max-w-full cursor-pointer touch-manipulation items-center gap-2.5 rounded-md px-3.5 py-2.5"
                        >
                          <div
                            id={option.id}
                            className="ring-foreground/50 -ml-0.25 size-4 rounded-sm ring-1"
                          >
                            <div className="ring-foreground bg-foreground text-background size-full scale-50 rounded-sm p-0.5 opacity-0 ring-1 transition group-data-checked/checkbox:scale-100 group-data-checked/checkbox:opacity-100">
                              <CheckIcon className="size-full" strokeWidth={4} />
                            </div>
                          </div>
                          <p className="min-w-0 shrink leading-tight select-none">{option.title}</p>
                        </button>
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <form.Subscribe
            selector={(state) => [state.submissionAttempts, state.errors]}
            children={([submissionAttempts, allErrors]) => {
              if (typeof allErrors === "number") return;
              if (typeof submissionAttempts !== "number") return;
              const errors = allErrors[0]?.selectedIds;
              const message = errors && errors.length > 0 ? errors[0]?.message : undefined;
              if (submissionAttempts > 0 && message) {
                return (
                  <ErrorLine className="mt-4 bg-transparent p-0 leading-tight" message={message} />
                );
              }
            }}
          />
        </div>
        <h2 className="mt-6 w-full text-lg leading-tight font-semibold">Endpoint</h2>
        <p className="text-muted-foreground mt-1 leading-tight">
          The events will be sent to this URL. They are automatically formatted based on the URL.
        </p>
        <form.AppField
          name="url"
          children={(field) => (
            <field.TextField
              dontCheckUntilSubmit
              className="-mx-1 mt-3 w-[calc(100%+0.5rem)]"
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
            />
          )}
        />
      </div>
      <div className="bg-background-hover flex w-full items-center justify-end rounded-b-lg border-t p-2 sm:p-2.5">
        <form.Subscribe
          selector={(state) => [state.isSubmitting]}
          children={([isSubmitting]) => (
            <form.SubmitButton className="px-4" isPending={isSubmitting}>
              Create Webhook
            </form.SubmitButton>
          )}
        />
      </div>
    </form>
  );
}
