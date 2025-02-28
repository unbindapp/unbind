"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

export default function GeneralTabContent() {
  const [canSave] = useState(false);

  function onProjectInfoFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    toast.success("Project info saved", {
      description: "This is fake...",
      duration: 3000,
      closeButton: false,
    });
  }

  return (
    <div className="w-full flex flex-col pt-4">
      <form
        onSubmit={onProjectInfoFormSubmit}
        className="w-full flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-3"
      >
        <div className="flex-1 flex flex-col gap-1.5">
          <label
            htmlFor="project-name"
            className="text-sm font-medium text-muted-foreground px-1"
          >
            Project Name
          </label>
          <Input id="project-name" placeholder="Name of the project" />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <label
            htmlFor="project-description"
            className="text-sm font-medium text-muted-foreground px-1"
          >
            Project Description
          </label>
          <Input
            id="project-description"
            placeholder="Description of the project"
          />
        </div>
        <Button disabled={!canSave} className="rounded-lg">
          Save
        </Button>
      </form>
    </div>
  );
}
