"use client";

import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getTakenNameError } from "@/lib/helpers/unique-name";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  createTeam as createTeamFn,
  queryKeyTeams,
  teamNameMaxLength,
  teamsListQuery,
  TeamUpdateFormSchema,
} from "@/lib/queries/teams";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ReactElement, useState } from "react";

type TProps = {
  children: ReactElement;
  dialogOnOpenChange?: (open: boolean) => void;
};

export function CreateTeamDialog({ children, dialogOnOpenChange }: TProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: teamsData } = useQuery(teamsListQuery());
  const uniqueAmong = { names: teamsData?.teams.map((t) => t.name) ?? [], entity: "a team" };

  const {
    mutateAsync: createTeam,
    error: createTeamError,
    reset: createTeamReset,
  } = useMutation({ mutationFn: createTeamFn });

  const [open, setOpen] = useState(false);

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    dialogOnOpenChange?.(o);
  };

  const form = useAppForm({
    defaultValues: { name: "", description: "" },
    validators: { onChange: TeamUpdateFormSchema },
    onSubmit: async ({ value }) => {
      const res = await createTeam({ name: value.name, description: value.description });
      await queryClient.invalidateQueries({ queryKey: queryKeyTeams.list() });
      onOpenChange(false);
      await router.navigate({ to: "/$team_id", params: { team_id: res.data.id } });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(o) => {
        if (o) return;
        form.reset();
        createTeamReset();
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Teams keep their projects, members and settings apart. You become its first admin.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit(e);
          }}
          className="flex flex-col gap-3"
        >
          <form.AppField
            name="name"
            validators={{ onChange: ({ value }) => getTakenNameError(value, uniqueAmong) }}
            children={(field) => (
              <field.TextField
                dontCheckUntilSubmit
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder="Name"
                maxLength={teamNameMaxLength}
              />
            )}
          />
          <form.AppField
            name="description"
            children={(field) => (
              <field.TextField
                dontCheckUntilSubmit
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder="Description (optional)"
              />
            )}
          />
          {createTeamError && <ErrorLine message={createTeamError.message} className="mt-1" />}
          <div className="mt-1 flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose
              className="text-muted-foreground"
              render={
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              }
            />
            <form.Subscribe
              selector={(state) => ({ isSubmitting: state.isSubmitting })}
              children={({ isSubmitting }) => (
                <form.SubmitButton
                  data-submitting={isSubmitting || undefined}
                  isPending={isSubmitting ? true : false}
                >
                  Create
                </form.SubmitButton>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
