/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { env } from "@/lib/env";
import { auth } from "@/server/auth/auth";
import { createClient } from "@/server/go/client.gen";
import { initTRPC, TRPCError } from "@trpc/server";
import { Session } from "next-auth";
import superjson from "superjson";
import { ZodError } from "zod";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers; skipAuth?: boolean }) => {
  let session: Session | null = null;

  if (!opts.skipAuth) {
    session = await auth();
  }

  const goClient: ReturnType<typeof createClient> = createClient({
    apiUrl: env.UNBIND_API_INTERNAL_URL,
    accessToken: session?.access_token || "",
  });

  type Result = {
    headers: Headers;
    session: Session | null;
    goClient: typeof goClient;
  };

  const result: Result = {
    headers: opts.headers,
    session,
    goClient,
  };
  return result;
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = performance.now();

  /* if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  } */

  const result = await next();
  const duration = Math.round(performance.now() - start);

  console.log(`[TRPC]: ${path} | ${duration}ms`);

  return result;
});

const authMiddleware = t.middleware(async ({ next, ctx }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You need to be logged in to access this resource",
    });
  }

  const result = await next();
  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);
export const privateProcedure = t.procedure.use(timingMiddleware).use(authMiddleware);
