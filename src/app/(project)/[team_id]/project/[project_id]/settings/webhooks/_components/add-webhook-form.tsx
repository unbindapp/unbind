"use client";

import ErrorLine from "@/components/error-line";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
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
      selectedIds: [] as TWebhookId[],
      url: "",
    },
    validators: {
      onChange: z.object({
        selectedIds: WebhookIdEnum.array().min(1, {
          message: "Select at least one event.",
        }),
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
        <form.AppField
          name="selectedIds"
          children={(field) => (
            <div className="mt-4 flex w-full flex-col">
              <div className="flex w-full flex-wrap gap-6 sm:gap-8">
                {webhookGroups.map((group) => (
                  <div
                    key={group.title}
                    className="flex w-full flex-col sm:w-[calc((100%-2rem)/2)]"
                  >
                    <h3 className="text-muted-foreground text-sm leading-tight font-medium">
                      {group.title}
                    </h3>
                    <div className="-mx-3 mt-1.5 flex w-[calc(100%+1.5rem)] flex-col items-start justify-start">
                      {group.options.map((option) => (
                        <label
                          key={option.id}
                          className="has-hover:hover:bg-border active:bg-border flex max-w-full cursor-pointer touch-manipulation items-center gap-2.5 rounded-md px-3.5 py-2.5"
                        >
                          <Checkbox
                            onBlur={field.handleBlur}
                            checked={field.state.value.includes(option.id)}
                            onCheckedChange={(c) => {
                              field.handleChange((prev) => {
                                if (c) {
                                  if (prev.includes(option.id)) return prev;
                                  return [...prev, option.id];
                                }
                                return prev.filter((id) => id !== option.id);
                              });
                            }}
                            className="-ml-0.25"
                          />
                          <p className="min-w-0 shrink leading-tight select-none">{option.title}</p>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <form.Subscribe
                selector={(state) => [state.submissionAttempts]}
                children={([submissionAttempts]) => {
                  const errors = field.state.meta.errors;
                  const message = errors && errors.length > 0 ? errors[0]?.message : undefined;
                  if (submissionAttempts > 0 && message) {
                    return (
                      <ErrorLine
                        className="mt-4 bg-transparent p-0 leading-tight"
                        message={message}
                      />
                    );
                  }
                }}
              />
            </div>
          )}
        />
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
