"use client";

import AccessField from "@/components/api-key/access-field";
import {
  emptyResourceRow,
  isRoleAllowed,
  scopedCapFrom,
  type TAccess,
  type TResourceCaps,
  type TResourceRow,
} from "@/components/api-key/helpers";
import InputSectionWrapper from "@/components/api-key/input-section-wrapper";
import PrivilegesField from "@/components/api-key/privileges-field";
import ResourceRows from "@/components/api-key/resource-rows";
import RoleField from "@/components/api-key/role-field";
import { cn } from "@/components/ui/utils";
import { withFieldGroup, type TAsyncAndSearchableSelectProps } from "@/lib/hooks/use-app-form";
import type { KeyPrivilege, PermittedAction } from "@/lib/server/client.gen";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { FC } from "react";

type TSubject = "key" | "application";

const captions: Record<TSubject, { access: string; role: string; privileges: string }> = {
  key: {
    access: "You can narrow down a key's permissions.",
    role: "The most a key can do on the resources above.",
    privileges: "Capabilities not covered by the role.",
  },
  application: {
    access: "What the application can access, never more than you can.",
    role: "The most the application can do on the resources above.",
    privileges: "Capabilities not covered by the role.",
  },
};

type TProps = {
  subject: TSubject;
  caps: TResourceCaps;
  classNameField: string;
  classNameText?: string;
  classNameFirstSection?: string;
  classNameSection?: string;
  isPlaceholder?: boolean;
};

// A field group's fields are typed with unknown form data and a never submit
// meta, which AnyFieldApi does not accept even though the runtime object is one.
const asFieldApi = (field: unknown) =>
  field as AnyFieldApi & { AsyncAndSearchableSelect: FC<TAsyncAndSearchableSelectProps> };

const props: TProps = {
  subject: "key",
  caps: { caps: [], setCap: () => {}, remove: () => {}, add: () => {}, reset: () => {} },
  classNameField: "",
};

// The Access, Role and Privileges sections shared by the API key form and the
// connected app consent screen. Mount with the form and a fields map naming
// the parent's access, rows, role and privileges fields.
export const AccessSections = withFieldGroup({
  defaultValues: {
    access: "full" as TAccess,
    rows: [emptyResourceRow] as TResourceRow[],
    role: "viewer" as PermittedAction,
    privileges: [] as KeyPrivilege[],
  },
  props,
  render: function Render({
    group,
    subject,
    caps,
    classNameField,
    classNameText,
    classNameFirstSection,
    classNameSection,
    isPlaceholder,
  }) {
    const text = captions[subject];
    const classNameHeading = cn("w-full text-lg leading-tight font-semibold", classNameText);
    const classNameCaption = cn("text-muted-foreground mt-1.5 leading-tight", classNameText);
    return (
      <>
        <h2 className={cn(classNameHeading, classNameFirstSection)}>Access</h2>
        <p className={classNameCaption}>{text.access}</p>
        <InputSectionWrapper>
          <group.AppField
            name="access"
            children={(field) => (
              <AccessField
                field={asFieldApi(field)}
                className={classNameField}
                isPlaceholder={isPlaceholder}
              />
            )}
          />
          <group.Subscribe selector={(state) => ({ access: state.values.access })}>
            {({ access }) =>
              access === "scoped" && (
                <group.AppField
                  name="rows"
                  children={(field) => <ResourceRows field={asFieldApi(field)} caps={caps} />}
                />
              )
            }
          </group.Subscribe>
        </InputSectionWrapper>
        <h2 className={cn(classNameHeading, classNameSection)}>Role</h2>
        <p className={classNameCaption}>{text.role}</p>
        <InputSectionWrapper>
          <group.Subscribe
            selector={(state) => ({ access: state.values.access, rows: state.values.rows })}
          >
            {({ access, rows }) => {
              const scopedCap = scopedCapFrom(rows, caps.caps);
              return (
                <group.AppField
                  name="role"
                  children={(field) => (
                    <RoleField
                      field={asFieldApi(field)}
                      className={classNameField}
                      isPlaceholder={isPlaceholder}
                      isAllowed={(role) => isRoleAllowed(access, scopedCap, role)}
                    />
                  )}
                />
              );
            }}
          </group.Subscribe>
        </InputSectionWrapper>
        <h2 className={cn(classNameHeading, classNameSection)}>Privileges</h2>
        <p className={classNameCaption}>{text.privileges}</p>
        <InputSectionWrapper>
          <group.AppField
            name="privileges"
            children={(field) => (
              <PrivilegesField
                field={asFieldApi(field)}
                className={classNameField}
                isPlaceholder={isPlaceholder}
              />
            )}
          />
        </InputSectionWrapper>
      </>
    );
  },
});
