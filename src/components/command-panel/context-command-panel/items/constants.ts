import { toast } from "sonner";

export default function onSelectPlaceholder(after: () => void) {
  toast.success("Successful", {
    description: "This is fake.",
    duration: 3000,
    closeButton: false,
  });
  after();
}
