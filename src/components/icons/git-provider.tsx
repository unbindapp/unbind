import { TGitProvider } from "@/app/(team)/[team_id]/connect-git/_components/constants";
import { cn } from "@/components/ui/utils";
import { ComponentProps } from "react";

type TProps = {
  variant: TGitProvider["slug"];
} & ComponentProps<"svg">;

const defaultClassName = "size-6";

export default function GitProviderIcon({ variant, className, ...rest }: TProps) {
  if (variant === "gitlab") {
    return (
      <svg
        aria-label="GitLab Icon"
        className={cn(defaultClassName, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        {...rest}
      >
        <path
          fill="currentColor"
          d="m21.668 9.993-.028-.072-2.722-7.104a.71.71 0 0 0-.704-.446.73.73 0 0 0-.41.153.73.73 0 0 0-.241.367l-1.838 5.623H8.28L6.443 2.891a.7.7 0 0 0-.241-.368.73.73 0 0 0-.833-.045.7.7 0 0 0-.28.338L2.36 9.917l-.027.072a5.055 5.055 0 0 0 1.677 5.842l.009.008.025.017 4.147 3.106 2.051 1.553 1.25.943a.84.84 0 0 0 1.017 0l1.25-.943 2.05-1.553 4.173-3.124.01-.009a5.06 5.06 0 0 0 1.675-5.836"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-label="GitHub Icon"
      className={cn(defaultClassName, className)}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
      {...rest}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12.007 1.675c-5.811 0-10.509 4.732-10.509 10.587 0 4.68 3.01 8.641 7.186 10.043.522.105.713-.228.713-.508 0-.245-.017-1.087-.017-1.963-2.923.63-3.532-1.262-3.532-1.262-.47-1.227-1.166-1.543-1.166-1.543-.957-.648.07-.648.07-.648 1.061.07 1.618 1.087 1.618 1.087.94 1.612 2.453 1.156 3.062.876.087-.684.365-1.157.661-1.42-2.331-.245-4.784-1.157-4.784-5.223 0-1.157.417-2.103 1.078-2.84-.104-.262-.47-1.35.105-2.804 0 0 .887-.28 2.888 1.087.856-.232 1.74-.35 2.627-.351.887 0 1.792.123 2.627.35 2-1.367 2.888-1.086 2.888-1.086.575 1.455.209 2.542.105 2.804.678.737 1.078 1.683 1.078 2.84 0 4.066-2.453 4.96-4.802 5.223.383.333.714.964.714 1.963 0 1.42-.018 2.56-.018 2.91 0 .28.192.613.714.508a10.58 10.58 0 0 0 7.185-10.043c.017-5.855-4.697-10.587-10.491-10.587"
        clipRule="evenodd"
      />
    </svg>
  );
}
