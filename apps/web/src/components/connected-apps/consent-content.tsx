"use client";

import { AccessSections } from "@/components/api-key/access-sections";
import {
  accessFormShape,
  emptyResourceRow,
  hasPickedResource,
  pickResourceMessage,
  rowToResource,
  useResourceCaps,
  type TAccess,
  type TResourceRow,
} from "@/components/api-key/helpers";
import { AuthShell } from "@/components/auth-shell";
import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  approveConnectedApp,
  connectedAppClientQuery,
  denyConnectedApp,
  type TConnectedAppClient,
} from "@/lib/queries/connected-apps";
import { meQuery } from "@/lib/queries/me";
import type { KeyPrivilege, PermittedAction } from "@/lib/server/client.gen";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  BoxIcon,
  CircleAlertIcon,
  GlobeIcon,
  MonitorIcon,
  ShieldCheckIcon,
} from "lucide-react";
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
      <AuthShell subtitle={subtitle} className="max-w-xl">
        <ErrorCard
          className="mt-6"
          message="This authorization request is incomplete. Start again from the application."
        />
      </AuthShell>
    );
  }
  return (
    <AuthShell subtitle={subtitle} className="max-w-xl">
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
  return (
    <>
      {data ? (
        <ClientSummary client={data.client} isLoopback={isOnDeviceUri(redirectUri)} />
      ) : (
        <ClientSummary isPlaceholder isLoopback={isOnDeviceUri(redirectUri)} />
      )}
      <ConsentForm
        clientId={clientId}
        redirectUri={redirectUri}
        state={state}
        codeChallenge={codeChallenge}
        resource={resource}
        scope={scope}
        isPlaceholder={!data}
      />
      <SignedInAs />
    </>
  );
}

const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];

// Loopback addresses and native app schemes such as cursor:// both land in an
// application on this device.
function isOnDeviceUri(uri: string) {
  try {
    const { protocol, hostname } = new URL(uri);
    if (protocol !== "http:" && protocol !== "https:") return true;
    return loopbackHosts.includes(hostname);
  } catch {
    return false;
  }
}

const detailClassName =
  "group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-foreground max-w-full leading-tight group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent";

function ClientSummary({
  client,
  isPlaceholder,
  isLoopback,
}:
  | { client: TConnectedAppClient; isPlaceholder?: never; isLoopback: boolean }
  | { client?: never; isPlaceholder: true; isLoopback: boolean }) {
  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      className="group/item mt-6 flex w-full flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 leading-tight">
        <div className="flex min-w-0 shrink items-start gap-1.5 text-lg leading-tight font-semibold">
          <div className="line-icon">
            <BrandIcon
              brand={client?.verified_brand}
              Fallback={BoxIcon}
              color="brand"
              className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground size-4.5 group-data-placeholder/item:rounded-full"
            />
          </div>
          <p className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground min-w-0 shrink group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
            {client ? client.name : "Loading"}
          </p>
        </div>
        {client?.verified_brand ? (
          <Chip variant="success" Icon={ShieldCheckIcon} classNameIcon="-ml-0.5">
            Verified
          </Chip>
        ) : (
          <Chip
            variant="warning"
            Icon={CircleAlertIcon}
            classNameIcon="-ml-0.5"
            classNameInner="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-more-foreground group-data-placeholder/item:border-muted-more-foreground group-data-placeholder/item:text-transparent"
          >
            Unverified
          </Chip>
        )}
      </div>
      <div className="text-muted-foreground flex w-full flex-col items-start gap-1.5 text-sm">
        <p className={detailClassName}>
          <GlobeIcon className="mr-1.5 mb-0.5 inline-block size-3.5" />
          {client ? (
            client.kind === "metadata_document" ? (
              <>
                Published by <span className="text-foreground">{client.client_host}</span>
              </>
            ) : (
              "Self-registered, unknown publisher"
            )
          ) : (
            "Published by loading.example.com"
          )}
        </p>
        <p className={detailClassName}>
          <ArrowRightIcon className="mr-1.5 mb-0.5 inline-block size-3.5" />
          {client ? (
            <>
              Redirects to <span className="text-foreground">{client.redirect_host}</span>
            </>
          ) : (
            "Redirects to loading.example.com"
          )}
        </p>
        {isLoopback && (
          <p className={cn(detailClassName, "text-warning")}>
            <MonitorIcon className="mr-1.5 mb-0.5 inline-block size-3.5" />
            Redirects to an application running on your device
          </p>
        )}
        <p className={cn(detailClassName, "text-warning")}>
          <CircleAlertIcon className="mr-1.5 mb-0.5 inline-block size-3.5" />
          Only approve if you started this yourself
        </p>
      </div>
    </div>
  );
}

function SignedInAs() {
  const { data: me } = useQuery(meQuery);
  return (
    <p
      data-placeholder={!me || undefined}
      className="group/item text-muted-foreground mt-4 w-full px-2 text-center text-sm leading-tight"
    >
      Signed in as{" "}
      <span className="text-foreground group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground font-medium group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
        {me ? me.email : "loading@example.com"}
      </span>
    </p>
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
  isPlaceholder,
}: TProps & {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  isPlaceholder: boolean;
}) {
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
  const busy = isPlaceholder || redirecting || approve.isPending || deny.isPending;
  const mutationError = approve.error ?? deny.error;

  const form = useAppForm({
    defaultValues: {
      access: "full" as TAccess,
      rows: [emptyResourceRow] as TResourceRow[],
      role: "viewer" as PermittedAction,
      privileges: [] as KeyPrivilege[],
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
        privileges: value.privileges,
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
        <AccessSections
          form={form}
          fields={{ access: "access", rows: "rows", role: "role", privileges: "privileges" }}
          subject="application"
          caps={caps}
          classNameField="mt-3 w-full"
          classNameSection="mt-6"
          isPlaceholder={isPlaceholder}
        />
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
