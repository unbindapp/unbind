import { cn } from "@/components/ui/utils";
import { ComponentProps } from "react";

type Props = {
  variant: "github" | "gitlab";
} & ComponentProps<"svg">;

const defaultClassName = "size-6";

export default function GitProviderIcon({ variant, className, ...rest }: Props) {
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
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path
        d="M12.001 2C6.475 1.998 2 6.593 2 12.264c0 4.485 2.8 8.297 6.699 9.697.525.135.444-.248.444-.51v-1.778c-3.032.365-3.155-1.696-3.358-2.04-.411-.721-1.383-.905-1.093-1.25.69-.364 1.395.093 2.21 1.33.59.897 1.74.746 2.324.596.127-.539.4-1.021.775-1.395-3.141-.578-4.45-2.548-4.45-4.889 0-1.136.364-2.18 1.079-3.022-.456-1.389.042-2.578.11-2.755 1.297-.119 2.647.955 2.752 1.04.737-.204 1.58-.312 2.522-.312.948 0 1.793.112 2.537.319.252-.197 1.503-1.12 2.71-1.008.065.177.552 1.338.123 2.709.724.844 1.092 1.898 1.092 3.036 0 2.346-1.318 4.317-4.468 4.887.27.272.484.597.63.956.146.358.221.743.22 1.132v2.582c.019.207 0 .411.336.411C19.151 20.63 22 16.79 22 12.266 22 6.593 17.522 2 12.001 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
