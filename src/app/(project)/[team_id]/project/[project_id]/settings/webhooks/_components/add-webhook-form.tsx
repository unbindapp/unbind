"use client";

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
        selectedIds: WebhookIdEnum.array(),
        url: z.string().url(),
      }),
    },
    onSubmit: async ({ formApi }) => {
      formApi.reset();
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
        <div className="mt-4 flex w-full flex-wrap gap-6 sm:gap-8">
          {webhookGroups.map((group) => (
            <div key={group.title} className="flex w-full flex-col sm:w-[calc((100%-2rem)/2)]">
              <h3 className="text-muted-foreground text-sm leading-tight font-medium">
                {group.title}
              </h3>
              <div className="mt-3.5 flex w-full flex-col gap-4">
                {group.options.map((option) => (
                  <div key={option.id} className="flex w-full gap-2.5">
                    <div className="border-foreground/50 size-4 shrink-0 rounded-sm border"></div>
                    <p className="-mt-0.5 min-w-0 shrink leading-tight">{option.title}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
      <div className="bg-background-hover flex w-full items-center justify-end rounded-b-lg border-t p-2.5">
        <form.Subscribe
          selector={(state) => [state.isSubmitting]}
          children={([isSubmitting]) => (
            <form.SubmitButton isPending={isSubmitting}>Create Webhook</form.SubmitButton>
          )}
        />
      </div>
    </form>
  );
}
