import NotFoundTemplate from "@/components/navigation/not-found-template";
import { UsersIcon } from "lucide-react";

export default function NotFound() {
  return (
    <NotFoundTemplate
      code={404}
      description="This team doesn't exist."
      buttonText="Go Home"
      buttonHref="/"
      Icon={UsersIcon}
    />
  );
}
