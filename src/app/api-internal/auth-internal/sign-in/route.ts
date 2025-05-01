import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const credentials = cookieStore.get("unbind-credentials");
  const emailBase64 = credentials?.value.split(":")[0];
  const passwordBase64 = credentials?.value.split(":")[1];

  if (!emailBase64 || !passwordBase64) {
    redirect("/sign-in");
  }

  const email = Buffer.from(emailBase64, "base64").toString();
  const password = Buffer.from(passwordBase64, "base64").toString();

  console.log("||| EMAIL", email);
  console.log("||| PASSWORD", password);

  const searchParams = request.nextUrl.searchParams;
  const redirect_uri = searchParams.get("redirect_uri");
  const client_id = searchParams.get("client_id");
  const response_type = searchParams.get("response_type");
  const state = searchParams.get("state");
  const scope = searchParams.get("scope");
  const page_key = searchParams.get("page_key");

  console.log("||| ", redirect_uri, client_id, response_type, state, scope, page_key);

  redirect("/sign-in");
}
