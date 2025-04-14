"use client";

import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useProject } from "@/components/project/project-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/components/ui/utils";
import { getWebhookIcon } from "@/components/webhook/helpers";
import { useWebhooksUtils } from "@/components/webhook/webhooks-provider";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TWebhookIdProjectEnum, WebhookIdProjectEnum } from "@/server/trpc/api/webhooks/types";
import { api } from "@/server/trpc/setup/client";
import { z } from "zod";

type TProps = {
  className?: string;
};

type TWebhookOption = {
  id: TWebhookIdProjectEnum;
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
  const { teamId, projectId } = useProject();
  const { invalidate: invalidateWebhooks } = useWebhooksUtils({
    type: "project",
    teamId,
    projectId,
  });

  const { mutateAsync: createWebhook } = api.webhooks.create.useMutation({
    onSuccess: () => {
      invalidateWebhooks();
    },
  });

  const form = useAppForm({
    defaultValues: {
      selectedIds: new Set<TWebhookIdProjectEnum>(),
      url: "",
    },
    validators: {
      onChange: z.object({
        selectedIds: z.set(WebhookIdProjectEnum).min(1, "Select at least one event."),
        url: z.string().url("Invalid URL."),
      }),
    },
    onSubmit: async ({ formApi, value }) => {
      const selectedIds = value.selectedIds;
      await createWebhook({
        type: "project",
        url: value.url,
        teamId,
        projectId,
        events: selectedIds,
      });
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
      className={cn("flex w-full flex-col rounded-xl border", className)}
    >
      <div className="flex w-full flex-col px-5 pt-3.5 pb-4.5 sm:px-6 sm:pt-4 sm:pb-6">
        <h2 className="w-full text-lg leading-tight font-semibold">Events</h2>
        <p className="text-muted-foreground mt-1.5 leading-tight">
          Select the events that will call the webhook.
        </p>
        <div className="mt-5 flex w-full flex-col">
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
                        <label
                          key={option.id}
                          className="has-hover:hover:bg-border active:bg-border flex w-full cursor-pointer items-center gap-2.75 rounded-md px-3.5 py-2.5"
                        >
                          <Checkbox
                            onBlur={field.handleBlur}
                            checked={field.state.value.has(option.id)}
                            onCheckedChange={(checked) => {
                              field.handleChange((prev) => {
                                const newSet = new Set(prev);
                                if (checked) newSet.add(option.id);
                                else newSet.delete(option.id);
                                return newSet;
                              });
                            }}
                          />
                          <p className="min-w-0 shrink leading-tight font-medium select-none">
                            {option.title}
                          </p>
                        </label>
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
        <p className="text-muted-foreground mt-1.5 leading-tight">
          The events will be sent to this URL. They are automatically formatted based on the
          platform.
        </p>
        <form.AppField
          name="url"
          children={(field) => (
            <div className="relative -mx-1 mt-3 w-[calc(100%+0.5rem)]">
              <field.TextField
                dontCheckUntilSubmit
                className="w-full"
                inputClassName="pl-9.5"
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
              />
              <form.Subscribe selector={(state) => [state.values.url]}>
                {([url]) => (
                  <BrandIcon
                    data-placeholder={url ? undefined : true}
                    color="brand"
                    className="data-placeholder:text-foreground/50 pointer-events-none absolute top-2.75 left-2.75 size-5"
                    brand={getWebhookIcon(url)}
                  />
                )}
              </form.Subscribe>
            </div>
          )}
        />
      </div>
      <div className="bg-background-hover flex w-full items-center justify-end rounded-b-xl border-t p-2 sm:p-2.5">
        <form.Subscribe selector={(state) => [state.isSubmitting]}>
          {([isSubmitting]) => (
            <form.SubmitButton className="px-4" isPending={isSubmitting}>
              Create Webhook
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
