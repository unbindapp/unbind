import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import ErrorLine from "@/components/error-line";
import ResponseHeadersInput from "@/components/service/panel/content/deployed/settings/sections/networking/_components/response-headers-input";
import {
  defaultRedirectStatusCode,
  headerLines,
  parseHeaderLine,
  redirectStatusCodes,
  routePath,
} from "@/components/staged-changes/host-target";
import type { THostTarget } from "@/components/staged-changes/types";
import { useSystem } from "@/components/system/system-provider";
import { withFieldGroup } from "@/lib/hooks/use-app-form";
import type { AnyFieldApi } from "@tanstack/react-form";
import {
  ArrowRightLeftIcon,
  CornerDownRightIcon,
  KeyRoundIcon,
  RouteIcon,
  UserIcon,
} from "lucide-react";

const redirectStatusLabels: Record<(typeof redirectStatusCodes)[number], string> = {
  301: "301 Moved Permanently",
  302: "302 Found",
  307: "307 Temporary Redirect",
  308: "308 Permanent Redirect",
};

const redirectStatusItems = redirectStatusCodes.map((code) => ({
  value: String(code),
  label: redirectStatusLabels[code],
}));

export type THostOptions = Pick<
  THostTarget,
  "path" | "redirect" | "proxy" | "basicAuth" | "responseHeaders"
>;

// The options as the form holds them
export type TDomainOptionsValues = {
  path: string;
  redirectTo: string;
  redirectStatus: string;
  proxyTo: string;
  basicAuthUsername: string;
  // Only ever typed, the server never returns it
  basicAuthPassword: string;
  responseHeaders: string[];
};

export const defaultDomainOptionsValues: TDomainOptionsValues = {
  path: "",
  redirectTo: "",
  redirectStatus: String(defaultRedirectStatusCode),
  proxyTo: "",
  basicAuthUsername: "",
  basicAuthPassword: "",
  responseHeaders: [],
};

export function domainOptionsToValues(options: THostOptions | undefined): TDomainOptionsValues {
  return {
    path: options?.path ?? "",
    redirectTo: options?.redirect?.to ?? "",
    redirectStatus: String(options?.redirect?.statusCode ?? defaultRedirectStatusCode),
    proxyTo: options?.proxy?.to ?? "",
    basicAuthUsername: options?.basicAuth?.username ?? "",
    basicAuthPassword: "",
    responseHeaders: headerLines(options?.responseHeaders),
  };
}

export function domainTarget(values: TDomainOptionsValues) {
  if (values.redirectTo.trim() !== "") return "redirect";
  if (values.proxyTo.trim() !== "") return "proxy";
  return "service";
}

export function domainOptionsFromValues(values: TDomainOptionsValues): THostOptions {
  const options: THostOptions = {};
  const target = domainTarget(values);
  const username = values.basicAuthUsername.trim();
  const path = values.path.trim();
  if (routePath(path) !== "/") options.path = path;
  if (target === "redirect") {
    options.redirect = { to: values.redirectTo.trim(), statusCode: Number(values.redirectStatus) };
  }
  if (target === "proxy") options.proxy = { to: values.proxyTo.trim() };
  if (target !== "redirect" && username) {
    options.basicAuth = { username, password: values.basicAuthPassword || undefined };
  }
  const headers = values.responseHeaders.map(parseHeaderLine).filter((h) => h !== null);
  if (headers.length > 0) options.responseHeaders = headers;
  return options;
}

export const domainOptionsFieldNames = [
  "path",
  "redirectTo",
  "redirectStatus",
  "proxyTo",
  "basicAuthUsername",
  "basicAuthPassword",
  "responseHeaders",
] as const;

export function validateDomainPath(value: string) {
  const path = routePath(value.trim());
  if (path === "/") return undefined;
  if (!path.startsWith("/")) return { message: "Start the path with /, like /api." };
  const segments = path.slice(1).split("/");
  if (segments.some((s) => s === "." || s === ".." || !/^[A-Za-z0-9._~-]+$/.test(s))) {
    return { message: "Use letters, digits and . _ ~ - between single slashes." };
  }
  return undefined;
}

function validateTargetUrl(value: string, kind: "redirect" | "proxy") {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (!/^https?:\/\//i.test(trimmed)) {
    return { message: "Enter a URL starting with https:// or http://." };
  }
  try {
    const url = new URL(trimmed);
    if (!url.hostname) return { message: "Enter a URL like https://example.com." };
    if (url.search || url.hash || url.username) {
      return { message: `A ${kind} URL cannot have a query, fragment or credentials.` };
    }
  } catch {
    return { message: "Enter a URL like https://example.com." };
  }
  return undefined;
}

export const validateRedirectTo = (value: string) => validateTargetUrl(value, "redirect");
export const validateProxyTo = (value: string) => validateTargetUrl(value, "proxy");

export function validateResponseHeaders(value: string[]) {
  if (value.some((line) => parseHeaderLine(line) === null)) {
    return { message: "Each header is Name: value, like Cache-Control: no-store." };
  }
  return undefined;
}

// A field group's fields are typed against an unknown form, which the field components reject
const asFieldApi = (field: unknown) => field as AnyFieldApi;

export const DomainOptionsFields = withFieldGroup({
  defaultValues: defaultDomainOptionsValues,
  props: {
    serverValues: defaultDomainOptionsValues,
  },
  render: function Render({ group, serverValues }) {
    const { data: systemData } = useSystem();
    const hasSavedPassword = serverValues.basicAuthUsername !== "";
    // A saved proxy stays editable so it can be removed after the provider changed
    const canProxy =
      systemData?.data.networking_provider === "gateway" || serverValues.proxyTo !== "";
    return (
      <>
        <Block>
          <group.AppField
            name="path"
            validators={{ onChange: ({ value }) => validateDomainPath(value) }}
          >
            {(field) => (
              <BlockItem className="w-full md:w-full">
                <BlockItemHeader type="column">
                  <BlockItemTitle>Path</BlockItemTitle>
                  <BlockItemDescription>
                    Answer only requests under this path, like /api. Leave it empty for the whole
                    domain.
                  </BlockItemDescription>
                </BlockItemHeader>
                <BlockItemContent>
                  <field.TextField
                    field={asFieldApi(field)}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="/"
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck="false"
                    Icon={RouteIcon}
                    hasChanges={
                      routePath(field.state.value.trim()) !== routePath(serverValues.path)
                    }
                  />
                </BlockItemContent>
              </BlockItem>
            )}
          </group.AppField>
        </Block>
        <group.Subscribe selector={(s) => domainTarget(s.values)}>
          {(target) => (
            <>
              {target !== "proxy" && (
                <Block>
                  <group.AppField
                    name="redirectTo"
                    validators={{ onChange: ({ value }) => validateRedirectTo(value) }}
                  >
                    {(field) => (
                      <BlockItem className="w-full md:w-full">
                        <BlockItemHeader type="column">
                          <BlockItemTitle>Redirect</BlockItemTitle>
                          <BlockItemDescription>
                            Send visitors to another URL instead of the service. The path is kept
                            when the URL has none.
                          </BlockItemDescription>
                        </BlockItemHeader>
                        <BlockItemContent>
                          <field.TextField
                            field={asFieldApi(field)}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="https://example.com"
                            autoCapitalize="off"
                            autoCorrect="off"
                            autoComplete="off"
                            spellCheck="false"
                            inputMode="url"
                            Icon={CornerDownRightIcon}
                            hasChanges={field.state.value.trim() !== serverValues.redirectTo}
                          />
                        </BlockItemContent>
                      </BlockItem>
                    )}
                  </group.AppField>
                </Block>
              )}
              {target === "redirect" && (
                <Block>
                  <group.AppField name="redirectStatus">
                    {(field) => (
                      <BlockItem className="w-full md:w-full">
                        <BlockItemHeader type="column">
                          <BlockItemTitle>Redirect Status</BlockItemTitle>
                        </BlockItemHeader>
                        <BlockItemContent>
                          <field.AsyncDropdownMenu
                            dontCheckUntilSubmit
                            field={asFieldApi(field)}
                            value={field.state.value}
                            onChange={(v) => field.handleChange(v)}
                            items={redirectStatusItems}
                            isPending={false}
                            error={undefined}
                          >
                            {({ isOpen }) => (
                              <BlockItemButtonLike
                                asElement="button"
                                text={
                                  redirectStatusItems.find((i) => i.value === field.state.value)
                                    ?.label ?? field.state.value
                                }
                                variant="outline"
                                open={isOpen}
                                onBlur={field.handleBlur}
                                hasChanges={field.state.value !== serverValues.redirectStatus}
                              />
                            )}
                          </field.AsyncDropdownMenu>
                        </BlockItemContent>
                      </BlockItem>
                    )}
                  </group.AppField>
                </Block>
              )}
              {target !== "redirect" && canProxy && (
                <Block>
                  <group.AppField
                    name="proxyTo"
                    validators={{ onChange: ({ value }) => validateProxyTo(value) }}
                  >
                    {(field) => (
                      <BlockItem className="w-full md:w-full">
                        <BlockItemHeader type="column">
                          <BlockItemTitle>Proxy</BlockItemTitle>
                          <BlockItemDescription>
                            Serve another URL on this domain instead of the service.
                          </BlockItemDescription>
                        </BlockItemHeader>
                        <BlockItemContent>
                          <field.TextField
                            field={asFieldApi(field)}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="https://example.com/install.sh"
                            autoCapitalize="off"
                            autoCorrect="off"
                            autoComplete="off"
                            spellCheck="false"
                            inputMode="url"
                            Icon={ArrowRightLeftIcon}
                            hasChanges={field.state.value.trim() !== serverValues.proxyTo}
                          />
                        </BlockItemContent>
                      </BlockItem>
                    )}
                  </group.AppField>
                </Block>
              )}
              {target !== "redirect" && (
                <Block>
                  <BlockItem className="w-full md:w-full">
                    <BlockItemHeader type="column">
                      <BlockItemTitle>Basic Auth</BlockItemTitle>
                      <BlockItemDescription>
                        Ask visitors for a username and password before the domain answers.
                      </BlockItemDescription>
                    </BlockItemHeader>
                    <BlockItemContent>
                      <div className="flex w-full flex-col">
                        <group.AppField name="basicAuthUsername">
                          {(field) => (
                            <field.TextField
                              field={asFieldApi(field)}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder="Username"
                              autoCapitalize="off"
                              autoCorrect="off"
                              autoComplete="off"
                              spellCheck="false"
                              Icon={UserIcon}
                              classNameInput="rounded-b-none"
                              hasChanges={
                                field.state.value.trim() !== serverValues.basicAuthUsername
                              }
                            />
                          )}
                        </group.AppField>
                        <div className="bg-border h-px w-full" />
                        <group.AppField
                          name="basicAuthPassword"
                          validators={{
                            onSubmit: ({ value }) => {
                              const isProtected =
                                group.getFieldValue("redirectTo").trim() === "" &&
                                group.getFieldValue("basicAuthUsername").trim() !== "";
                              if (!isProtected || hasSavedPassword || value !== "")
                                return undefined;
                              return { message: "Enter a password." };
                            },
                          }}
                        >
                          {(field) => (
                            <field.TextField
                              field={asFieldApi(field)}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              type="password"
                              placeholder={hasSavedPassword ? "Password (unchanged)" : "Password"}
                              autoComplete="new-password"
                              Icon={KeyRoundIcon}
                              classNameInput="rounded-t-none border-t-0"
                              hasChanges={field.state.value !== ""}
                            />
                          )}
                        </group.AppField>
                      </div>
                    </BlockItemContent>
                  </BlockItem>
                </Block>
              )}
            </>
          )}
        </group.Subscribe>
        <Block>
          <group.AppField
            name="responseHeaders"
            validators={{ onChange: ({ value }) => validateResponseHeaders(value) }}
          >
            {(field) => (
              <BlockItem className="w-full md:w-full">
                <BlockItemHeader type="column">
                  <BlockItemTitle>Response Headers</BlockItemTitle>
                  <BlockItemDescription>
                    Set on every response of the domain, as Name: value.
                  </BlockItemDescription>
                </BlockItemHeader>
                <BlockItemContent>
                  <div className="flex w-full flex-col gap-1.5">
                    <ResponseHeadersInput
                      value={field.state.value}
                      serverValue={serverValues.responseHeaders}
                      onChange={(v) => field.handleChange(v)}
                      onBlur={field.handleBlur}
                    />
                    {field.state.meta.errors.length > 0 && field.state.meta.isTouched && (
                      <ErrorLine message={field.state.meta.errors[0]?.message} />
                    )}
                  </div>
                </BlockItemContent>
              </BlockItem>
            )}
          </group.AppField>
        </Block>
      </>
    );
  },
});
