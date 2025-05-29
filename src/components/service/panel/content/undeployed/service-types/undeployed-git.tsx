import BrandIcon from "@/components/icons/brand";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import DeployButtonSection from "@/components/service/panel/content/undeployed/deploy-button-section";
import { WrapperForm, WrapperInner } from "@/components/service/panel/content/undeployed/wrapper";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { api } from "@/server/trpc/setup/client";
import { GitBranchIcon } from "lucide-react";
import { toast } from "sonner";

/* const privateServiceText = "Private service"; */

type TProps = {
  repo: string;
  owner: string;
  branch: string;
  installationId: number;
  port: number | null;
};

export function UndeployedContentGit({ repo, owner, branch, installationId, port }: TProps) {
  const form = useAppForm({
    defaultValues: {
      branch: branch,
      domain: "",
      isPublic: true,
      port: port,
    },
    onSubmit: ({ value }) => {
      toast.info("Submitted", {
        description: JSON.stringify(value, null, 2),
      });
    },
  });

  const {
    data: dataRepository,
    isPending: isPendingRepository,
    error: errorRepository,
  } = api.git.getRepository.useQuery({
    owner,
    repoName: repo,
    installationId,
  });

  return (
    <WrapperForm
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit(e);
      }}
    >
      <WrapperInner>
        {/* Repository and Branch */}
        <Block>
          {/* Repository */}
          <BlockItem>
            <BlockItemHeader>
              <BlockItemTitle>Repository</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <BlockItemButtonLike
                asElement="div"
                text={`${owner}/${repo}`}
                Icon={({ className }) => (
                  <BrandIcon brand="github" color="brand" className={className} />
                )}
              />
            </BlockItemContent>
          </BlockItem>
          {/* Branch */}
          <BlockItem>
            <BlockItemHeader>
              <BlockItemTitle>Branch</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <form.AppField
                name="branch"
                children={(field) => (
                  <field.AsyncDropdown
                    dontCheckUntilSubmit
                    field={field}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    items={dataRepository?.repository.branches?.map((b) => b.name)}
                    isPending={isPendingRepository}
                    error={errorRepository?.message}
                    commandInputPlaceholder="Search branches..."
                    commandEmptyText="No branches found"
                    CommandEmptyIcon={GitBranchIcon}
                  >
                    {({ isOpen }) => (
                      <BlockItemButtonLike
                        asElement="button"
                        text={field.state.value}
                        Icon={({ className }) => (
                          <GitBranchIcon className={cn("scale-90", className)} />
                        )}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </field.AsyncDropdown>
                )}
              />
            </BlockItemContent>
          </BlockItem>
        </Block>
      </WrapperInner>
      <DeployButtonSection isPending={false} />
    </WrapperForm>
  );
}
