"use client";

import AccessField from "@/components/api-key/access-field";
import {
  accessFormShape,
  emptyResourceRow,
  hasPickedResource,
  isRoleAllowed,
  pickResourceMessage,
  rowToResource,
  scopedCapFrom,
  useResourceCaps,
  type TAccess,
  type TResourceRow,
} from "@/components/api-key/helpers";
import InputSectionWrapper from "@/components/api-key/input-section-wrapper";
import ResourceRows from "@/components/api-key/resource-rows";
import RoleField from "@/components/api-key/role-field";
import { AuthShell } from "@/components/auth-shell";
import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  approveConnectedApp,
  connectedAppClientQuery,
  denyConnectedApp,
  type TConnectedAppClient,
} from "@/lib/queries/connected-apps";
import { meQuery } from "@/lib/queries/me";
import { getGoClient } from "@/lib/server/client";
import type { PermittedAction } from "@/lib/server/client.gen";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ArrowRightIcon, GlobeIcon, MonitorIcon, ShieldQuestionIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

type TProps = {
  clientId?: string;
  redirectUri?: string;
  state?: string;
  codeChallenge?: string;
  resource?: string;
  scope?: string;
};

const subtitle = "An application is asking for access to your account";

export default function ConsentContent(props: TProps) {
  const { clientId, redirectUri, codeChallenge } = props;
  if (!clientId || !redirectUri || !codeChallenge) {
    return (
      <AuthShell subtitle={subtitle} className="max-w-lg">
        <ErrorCard
          className="mt-6"
          message="This authorization request is incomplete. Start again from the application."
        />
      </AuthShell>
    );
  }
  return (
    <AuthShell subtitle={subtitle} className="max-w-lg">
      <ConsentBody
        {...props}
        clientId={clientId}
        redirectUri={redirectUri}
        codeChallenge={codeChallenge}
      />
    </AuthShell>
  );
}

function ConsentBody({
  clientId,
  redirectUri,
  state,
  codeChallenge,
  resource,
  scope,
}: TProps & { clientId: string; redirectUri: string; codeChallenge: string }) {
  const { data, isPending, error } = useQuery(connectedAppClientQuery({ clientId, redirectUri }));

  if (!data && !isPending && error) {
    return <ErrorCard className="mt-6" message={error.message} />;
  }
  if (!data) {
    return <ClientSummary isPlaceholder />;
  }
  return (
    <>
      <ClientSummary client={data.client} />
      <SignedInAs />
      <ConsentForm
        clientId={clientId}
        redirectUri={redirectUri}
        state={state}
        codeChallenge={codeChallenge}
        resource={resource}
        scope={scope}
      />
    </>
  );
}

function ClientSummary({
  client,
  isPlaceholder,
}:
  | { client: TConnectedAppClient; isPlaceholder?: never }
  | { client?: never; isPlaceholder: true }) {
  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      className="group/item mt-6 flex w-full flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 leading-tight">
        <p className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground min-w-0 shrink text-lg font-semibold group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
          {client ? client.name : "Loading application"}
        </p>
        <p className="bg-warning/4-10 border-warning/4-10 text-warning group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-more-foreground group-data-placeholder/item:border-muted-more-foreground rounded-sm border px-1.5 py-0.5 text-xs font-medium group-data-placeholder/item:text-transparent">
          <ShieldQuestionIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
          Unverified name
        </p>
      </div>
      <div className="text-muted-foreground group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-foreground flex w-full flex-col gap-1.5 text-sm leading-tight group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
        <p>
          <GlobeIcon className="mr-1.5 mb-0.5 inline-block size-3.5" />
          {client
            ? client.kind === "metadata_document"
              ? `Published by ${client.client_host}`
              : "Registered automatically, no verified publisher"
            : "Loading publisher"}
        </p>
        <p>
          <ArrowRightIcon className="mr-1.5 mb-0.5 inline-block size-3.5" />
          {client ? `Redirects to ${client.redirect_host}` : "Loading redirect"}
        </p>
        {client?.loopback_only && (
          <p className="text-warning">
            <MonitorIcon className="mr-1.5 mb-0.5 inline-block size-3.5" />
            Redirects to an application running on this device. Only continue if you started this
            from an app you trust.
          </p>
        )}
      </div>
    </div>
  );
}

function SignedInAs() {
  const { data: me } = useQuery(meQuery);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { mutate: signOut, isPending } = useMutation({
    mutationFn: async () => await getGoClient().auth.logout(),
    onSuccess: () => {
      queryClient.setQueryData(meQuery.queryKey, null);
      router.navigate({
        to: "/sign-in",
        search: { redirect: window.location.pathname + window.location.search },
      });
    },
  });
  return (
    <div className="text-muted-foreground mt-3 flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-sm leading-tight">
      <p className="min-w-0 shrink">
        Signed in as <span className="text-foreground font-medium">{me?.email ?? "…"}</span>
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-mr-2 h-7 px-2"
        isPending={isPending}
        onClick={() => signOut()}
      >
        Not you? Sign out
      </Button>
    </div>
  );
}

const FormSchema = z.object(accessFormShape).refine(hasPickedResource, pickResourceMessage);

function ConsentForm({
  clientId,
  redirectUri,
  state,
  codeChallenge,
  resource,
  scope,
}: TProps & { clientId: string; redirectUri: string; codeChallenge: string }) {
  const caps = useResourceCaps();
  const [redirecting, setRedirecting] = useState(false);

  const leave = (url: string) => {
    setRedirecting(true);
    window.location.assign(url);
  };

  const approve = useMutation({
    mutationFn: approveConnectedApp,
    onSuccess: (res) => leave(res.data.redirect_url),
  });
  const deny = useMutation({
    mutationFn: denyConnectedApp,
    onSuccess: (res) => leave(res.data.redirect_url),
  });
  const busy = redirecting || approve.isPending || deny.isPending;
  const mutationError = approve.error ?? deny.error;

  const form = useAppForm({
    defaultValues: {
      access: "full" as TAccess,
      rows: [emptyResourceRow] as TResourceRow[],
      role: "viewer" as PermittedAction,
    },
    validators: { onChange: FormSchema },
    onSubmit: async ({ value }) => {
      const resources =
        value.access === "scoped" ? value.rows.map(rowToResource).filter((r) => r !== null) : [];
      await approve.mutateAsync({
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        code_challenge: codeChallenge,
        resource,
        scope,
        role: value.role,
        full_access: value.access === "full",
        resources,
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit(e);
      }}
      className="mt-3 flex w-full flex-col rounded-xl border"
    >
      <div className="flex w-full flex-col px-4 pt-3 pb-4">
        <h2 className="w-full text-lg leading-tight font-semibold">Access</h2>
        <p className="text-muted-foreground mt-1.5 leading-tight">
          What the application can reach. Never more than you can.
        </p>
        <InputSectionWrapper>
          <form.AppField
            name="access"
            children={(field) => <AccessField field={field} className="mt-3 w-full" />}
          />
          <form.Subscribe selector={(s) => ({ access: s.values.access })}>
            {({ access }) =>
              access === "scoped" && (
                <form.AppField
                  name="rows"
                  children={(field) => <ResourceRows field={field} caps={caps} />}
                />
              )
            }
          </form.Subscribe>
        </InputSectionWrapper>
        <h2 className="mt-6 w-full text-lg leading-tight font-semibold">Role</h2>
        <p className="text-muted-foreground mt-1.5 leading-tight">
          The most the application can do on the resources above.
        </p>
        <InputSectionWrapper>
          <form.Subscribe selector={(s) => ({ access: s.values.access, rows: s.values.rows })}>
            {({ access, rows }) => {
              const scopedCap = scopedCapFrom(rows, caps.caps);
              return (
                <form.AppField
                  name="role"
                  children={(field) => (
                    <RoleField
                      field={field}
                      className="mt-3 w-full"
                      isAllowed={(role) => isRoleAllowed(access, scopedCap, role)}
                    />
                  )}
                />
              );
            }}
          </form.Subscribe>
        </InputSectionWrapper>
        {mutationError && <ErrorLine className="mt-4" message={mutationError.message} />}
      </div>
      <div
        className={cn(
          "bg-card flex w-full items-center justify-end gap-2 rounded-b-xl border-t p-2 sm:p-2.5",
        )}
      >
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          isPending={deny.isPending}
          onClick={() => deny.mutate({ client_id: clientId, redirect_uri: redirectUri, state })}
        >
          Deny
        </Button>
        <form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting })}>
          {({ isSubmitting }) => (
            <form.SubmitButton
              className="px-4"
              disabled={busy}
              isPending={isSubmitting || redirecting}
            >
              Approve
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
