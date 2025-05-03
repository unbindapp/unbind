import { TFormValues } from "@/components/auth/types";
import { useEffect, useMemo, useRef, useState } from "react";

type TProps = {
  formValues: TFormValues;
  error: string | undefined;
};

export default function useSignInLikeForm({ formValues, error }: TProps) {
  const hasHiddenFormValues =
    formValues.username && formValues.password && formValues.client_id && formValues.response_type;
  const hasHiddenForm = hasHiddenFormValues && !error ? true : undefined;

  const [email, setEmail] = useState<string>(hasHiddenFormValues ? formValues.username || "" : "");
  const [password, setPassword] = useState<string>(
    hasHiddenFormValues ? formValues.password || "" : "",
  );

  const hiddenFormRef = useRef<HTMLFormElement>(null);
  const [isHiddenFormSubmitting, setIsHiddenFormSubmitting] = useState(false);

  useEffect(() => {
    if (!hasHiddenForm) return;
    if (isHiddenFormSubmitting) return;
    if (!hiddenFormRef.current) return;

    setIsHiddenFormSubmitting(true);
    if (formValues.initiating_url) window.location.href = formValues.initiating_url;
    hiddenFormRef.current.submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHiddenForm]);

  const values = useMemo(
    () => ({
      email,
      setEmail,
      password,
      setPassword,
      hasHiddenForm,
      setIsHiddenFormSubmitting,
      isHiddenFormSubmitting,
      hiddenFormRef,
    }),
    [email, password, hasHiddenForm, isHiddenFormSubmitting],
  );

  return values;
}
