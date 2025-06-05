import NotFoundTemplate from "@/components/navigation/not-found-template";
import { TriangleAlertIcon } from "lucide-react";

export default function NotFound() {
  return (
    <NotFoundTemplate
      code={404}
      description="Not found."
      buttonText="Go Home"
      buttonHref="/"
      Icon={TriangleAlertIcon}
    />
  );
}
