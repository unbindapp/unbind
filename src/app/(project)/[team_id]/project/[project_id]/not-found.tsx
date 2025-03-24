import NotFoundTemplate from "@/components/navigation/not-found-template";
import { FolderIcon } from "lucide-react";

export default function NotFound() {
  return (
    <NotFoundTemplate
      code={404}
      description="This project doesn't exist"
      buttonText="Go Home"
      buttonHref="/"
      Icon={FolderIcon}
    />
  );
}
