"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { observeFirebasePublicQuery } from "./public-query";
import { firebaseQueryKey } from "./query-key";
import { useFirebaseAuth } from "./auth-context";
import {
  getOperationName,
  type OperationArgs,
  type OperationReference,
  type OperationReturnType,
} from "./operations";

type QueryState<T> =
  | { error: Error; value?: never }
  | { error?: never; value: T | undefined };

export type InitialFirebaseQueries = Record<string, unknown>;

const InitialQueryContext = createContext<InitialFirebaseQueries>({});

export function FirebaseQueryHydrationProvider({
  children,
  initialQueries,
}: {
  children: ReactNode;
  initialQueries?: InitialFirebaseQueries;
}) {
  return createElement(
    InitialQueryContext.Provider,
    { value: initialQueries ?? {} },
    children,
  );
}

export function useFirebaseQuery<Query extends OperationReference<"query">>(
  reference: Query,
  args: OperationArgs<Query> | "skip" = {} as OperationArgs<Query>,
): OperationReturnType<Query> | undefined {
  const functionName = getOperationName(reference);
  const { isLoaded: isAuthLoaded, user } = useFirebaseAuth();
  const initialQueries = useContext(InitialQueryContext);
  const argsKey = args === "skip" ? "skip" : JSON.stringify(args);
  const stableArgs = useMemo(
    () => (argsKey === "skip" ? "skip" : JSON.parse(argsKey)),
    [argsKey],
  );
  const queryKey =
    stableArgs === "skip"
      ? null
      : firebaseQueryKey(functionName, stableArgs);
  const hasInitialValue = Boolean(
    queryKey && Object.prototype.hasOwnProperty.call(initialQueries, queryKey),
  );
  const [state, setState] = useState<QueryState<OperationReturnType<Query>>>(() => ({
    value: hasInitialValue
      ? (initialQueries[queryKey!] as OperationReturnType<Query>)
      : undefined,
  }));

  useEffect(() => {
    if (!isAuthLoaded) return;
    if (stableArgs === "skip") {
      setState({ value: undefined });
      return;
    }

    if (!hasInitialValue) setState({ value: undefined });
    return observeFirebasePublicQuery(
      functionName,
      stableArgs,
      (value) =>
        setState({ value: value as OperationReturnType<Query> }),
      (error) => setState({ error }),
      user?.uid ?? null,
    );
  }, [
    functionName,
    hasInitialValue,
    initialQueries,
    isAuthLoaded,
    queryKey,
    stableArgs,
    user?.uid,
  ]);

  if (state.error) throw state.error;
  return state.value;
}
