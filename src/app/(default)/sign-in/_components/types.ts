export type TSignInLikePageProps = {
  searchParams: Promise<{
    redirect_pathname?: string;
    redirect_uri?: string;
    client_id?: string;
    response_type?: string;
    state?: string;
    initiating_url?: string;
    scope?: string;
    error?: string;
  }>;
};

export type TSignInLikeFormProps = {
  className?: string;
  redirectPathname?: string;
  formValues: TFormValues;
  loginUrl: string;
  error: string | undefined;
};

export type TFormValues = {
  username: string | undefined;
  password: string | undefined;
  redirect_uri: string | undefined;
  client_id: string | undefined;
  response_type: string | undefined;
  state: string | undefined;
  scope: string | undefined;
  page_key: string | undefined;
  initiating_url: string | undefined;
};
