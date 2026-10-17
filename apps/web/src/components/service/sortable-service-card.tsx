import ServiceCard from "@/components/service/service-card";
import type { TServiceShallow } from "@/lib/queries/services";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ComponentProps } from "react";

type TProps = {
  service: TServiceShallow;
  disabled: boolean;
} & Omit<
  Extract<ComponentProps<typeof ServiceCard>, { service: TServiceShallow }>,
  "ref" | "dragListeners" | "isDragging" | "isDragSource"
>;

export default function SortableServiceCard({ service, disabled, ...rest }: TProps) {
  // The list itself reorders while dragging, the transform only animates the card to its new place
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: service.id,
    disabled,
  });

  return (
    <ServiceCard
      {...rest}
      service={service}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      dragListeners={disabled ? undefined : listeners}
      isDragSource={isDragging}
    />
  );
}
