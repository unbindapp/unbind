import BrandIcon from "@/components/icons/brand";
import { TTemplateDraft } from "@/components/templates/template-draft-store";
import { cn } from "@/components/ui/utils";

type TProps = {
  templateDraft: TTemplateDraft;
  className?: string;
  color?: Parameters<typeof BrandIcon>["0"]["color"];
};

export default function TemplateDraftIcon({ templateDraft, color = "brand", className }: TProps) {
  return (
    <BrandIcon
      color={color}
      brand={templateDraft.template.icon}
      className={cn("size-6", className)}
    />
  );
}
