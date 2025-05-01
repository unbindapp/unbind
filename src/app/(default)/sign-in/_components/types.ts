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
