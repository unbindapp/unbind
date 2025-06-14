import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { useProject } from "@/components/project/project-provider";
import { useTemplateDraftPanel } from "@/components/templates/panel/template-draft-panel-provider";
import { TTemplateDraft } from "@/components/templates/template-draft-store";
import { useTemplateDraftStore } from "@/components/templates/template-draft-store-provider";
import { useTemplates } from "@/components/templates/templates-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { BlocksIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

type TProps = {
  context: TContextCommandPanelContext;
};

export function useTemplateItemHook({ context }: TProps) {
  const hook = useMemo(() => {
    if (context.contextType !== "project" && context.contextType !== "new-service") {
      return () => ({
        item: null,
      });
    }
    return useTemplateItem;
  }, [context]);

  return hook;
}

function useTemplateItem({}: TProps) {
  const mainPageId = "template";
  const subpageId = "template_subpage";

  const { closePanel: closeCommandPanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const { environmentId: environmentIdFromPathname } = useIdsFromPathname();

  const {
    teamId,
    projectId,
    query: { data: projectData },
  } = useProject();

  const environments = projectData?.project.environments;
  const defaultEnvironmentId = projectData?.project.default_environment_id || environments?.[0]?.id;

  const {
    data: { templates },
  } = useTemplates();

  const createTemplateDraft = useTemplateDraftStore((s) => s.add);
  const { openPanel: openTemplateDraftPanel } = useTemplateDraftPanel();

  const templateItems: TCommandPanelItem[] = useMemo(() => {
    return templates.map((template) => {
      const item: TCommandPanelItem = {
        id: `${subpageId}_${template.name.replaceAll(" ", "-").toLowerCase()}`,
        title: template.name,
        description: () => (
          <div className="text-muted-foreground flex min-w-0 shrink flex-col gap-2 text-sm leading-tight font-normal">
            <p className="min-w-0 shrink">{template.description}</p>
            <div className="flex min-w-0 shrink flex-row flex-wrap items-start gap-1">
              <p className="min-w-0 shrink">
                {template.definition.services.length}{" "}
                {`service${template.definition.services.length >= 2 ? "s" : ""}`}
                <span className="text-muted-more-foreground pr-[0.35ch] pl-[0.75ch]">{"|"}</span>
              </p>
              <div className="mt-[0.07rem] inline-flex min-w-0 shrink items-center gap-1.5">
                {[...new Set(template.definition.services.map((s) => s.icon))].map((icon) => (
                  <BrandIcon key={icon} brand={icon} color="monochrome" className="size-4" />
                ))}
              </div>
            </div>
          </div>
        ),
        keywords: template.keywords,
        onSelect: () => {
          const id = uuidv4();
          const environmentId = environmentIdFromPathname || defaultEnvironmentId;
          if (!environmentId) {
            toast.error("No environment", {
              description: "Environment not found.",
            });
            return;
          }
          const templateDraft: TTemplateDraft = {
            id,
            teamId: teamId,
            projectId: projectId,
            environmentId: environmentId,
            name: template.name,
            description: template.description,
            template: template,
            createdAt: new Date().toISOString(),
          };
          createTemplateDraft(templateDraft);
          closeCommandPanel();
          openTemplateDraftPanel(id);
        },
        Icon: ({ className }: { className?: string }) => (
          <BrandIcon brand={template.icon} color="brand" className={className} />
        ),
      };
      return item;
    });
  }, [
    templates,
    closeCommandPanel,
    openTemplateDraftPanel,
    createTemplateDraft,
    environmentIdFromPathname,
    defaultEnvironmentId,
    teamId,
    projectId,
  ]);

  const item: TCommandPanelItem = useMemo(() => {
    return {
      id: mainPageId,
      title: "Template",
      keywords: ["blueprint", "stack", "group", "deploy"],
      Icon: BlocksIcon,
      subpage: {
        id: subpageId,
        title: "Templates",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Deploy a template...",
        items: templateItems,
      },
    };
  }, [templateItems]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
