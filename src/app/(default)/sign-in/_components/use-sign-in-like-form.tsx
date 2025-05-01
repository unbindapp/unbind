import { TFormValues } from "@/app/(default)/sign-in/_components/types";
import { useEffect, useMemo, useRef, useState } from "react";

type TProps = {
  formValues: TFormValues;
  error: string | undefined;
};

export default function useSignInLikeForm({ formValues, error }: TProps) {
  const hasHiddenForm =
    formValues.username &&
    formValues.password &&
    formValues.client_id &&
    formValues.response_type &&
    !error
      ? true
      : undefined;

  const [email, setEmail] = useState<string>(hasHiddenForm ? formValues.username || "" : "");
  const [password, setPassword] = useState<string>(hasHiddenForm ? formValues.password || "" : "");

  const hiddenFormRef = useRef<HTMLFormElement>(null);
  const [isHiddenFormSubmitting, setIsHiddenFormSubmitting] = useState(false);

  useEffect(() => {
    if (!hasHiddenForm) return;
    if (isHiddenFormSubmitting) return;
    if (!hiddenFormRef.current) return;

    setIsHiddenFormSubmitting(true);
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
    [email, password, hasHiddenForm],
  );

  return values;
}
