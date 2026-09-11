import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import BrandIcon from "@/components/icons/brand";
import { useProject } from "@/components/project/project-provider";
import { useTemplateDraftPanel } from "@/components/templates/panel/template-draft-panel-provider";
import { TTemplateDraft } from "@/components/templates/template-draft-store";
import { useTemplateDraftStore } from "@/components/templates/template-draft-store-provider";
import { useTemplates } from "@/components/templates/templates-provider";
import { toast } from "@/components/ui/toast";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { BlocksIcon, CpuIcon, MemoryStickIcon } from "lucide-react";
import { useMemo } from "react";
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

function useTemplateItem() {
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
        description: () => {
          const iconSet = [...new Set(template.definition.services.map((s) => s.icon))];
          return (
            <div className="text-muted-foreground flex min-w-0 shrink flex-col gap-2 text-sm leading-tight font-normal">
              <p className="min-w-0 shrink">{template.description}</p>
              <p className="min-w-0 shrink">
                <span className="pr-[0.6ch]">
                  {template.definition.services.length}{" "}
                  {`service${template.definition.services.length >= 2 ? "s" : ""}:`}
                </span>
                {iconSet.map((icon, index) => (
                  <BrandIcon
                    data-last={index === iconSet.length - 1 || undefined}
                    brand={icon}
                    color="monochrome"
                    className="mr-[0.6ch] mb-0.5 inline-block size-4 data-last:mr-0"
                  />
                ))}
                <span className="text-muted-most-foreground px-[1ch]">{"|"}</span>
                <span className="pr-[0.6ch]">{"Min:"}</span>
                <CpuIcon className="mr-[0.4ch] mb-0.5 inline-block size-4" />
                <span>{template.resource_recommendations.minimum_recommended_cpu}</span>
                <span className="text-muted-most-foreground px-[0.5ch]">{"•"}</span>
                <MemoryStickIcon className="mr-[0.4ch] mb-0.5 inline-block size-4" />
                <span>{template.resource_recommendations.minimum_recommended_ram_gb} GB</span>
              </p>
            </div>
          );
        },
        keywords: template.keywords,
        onSelect: () => {
          const id = uuidv4();
          const environmentId = environmentIdFromPathname || defaultEnvironmentId;
          if (!environmentId) {
            toast.add({
              type: "error",
              title: "No environment",
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
