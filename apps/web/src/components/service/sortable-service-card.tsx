import ServiceCard from "@/components/service/service-card";
import type { TServiceShallow } from "@/lib/queries/services";
import { useSortable } from "@dnd-kit/sortable";
import type { ComponentProps } from "react";

type TProps = {
  service: TServiceShallow;
  disabled: boolean;
} & Omit<
  Extract<ComponentProps<typeof ServiceCard>, { service: TServiceShallow }>,
  "ref" | "dragListeners" | "isDragging" | "isDragSource"
>;

export default function SortableServiceCard({ service, disabled, ...rest }: TProps) {
  // The list itself moves while dragging and a copy follows the pointer, so the card never moves on its own
  const { setNodeRef, listeners, isDragging } = useSortable({ id: service.id, disabled });

  return (
    <ServiceCard
      {...rest}
      service={service}
      ref={setNodeRef}
      dragListeners={disabled ? undefined : listeners}
      isDragSource={isDragging}
    />
  );
}
