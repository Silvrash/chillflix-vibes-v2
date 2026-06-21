import axios from "axios";

/**
 * All TMDB traffic is proxied through our own Next.js route handler
 * (`/api/tmdb/[...path]`) so the API token stays server-side. The browser
 * therefore talks to a same-origin endpoint and never sees the token.
 */
const TMDB_PROXY_BASE_URL = "/api/tmdb";

export function getTMDBAxiosInstance(baseUrl?: string) {
  return axios.create({
    baseURL: baseUrl ?? TMDB_PROXY_BASE_URL,
  });
}

export interface QueryFnOptions<TVariables> {
  variables?: TVariables;
  signal?: AbortSignal;
  page?: number;
}

export interface MutationFnOptions<TVariables> {
  variables?: TVariables;
  signal?: AbortSignal;
}

function convertVariablesToQueryParams<TVariables>(variables?: TVariables) {
  if (!variables) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(variables as Record<string, unknown>)) {
    // Skip empty values so we never send `?language=undefined` to TMDB.
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const params = search.toString();
  return params ? `?${params}` : "";
}

export async function tmdbGetFn<TResponse, TVariables>(path: string, options: QueryFnOptions<TVariables>): Promise<TResponse> {
  let { variables, signal, page } = options;

  if (page && variables) {
    variables = { ...variables, page } as TVariables;
  }

  const [urlPath, newVariables] = path.includes("[")
    ? getFormattedMutationURLPathAndVariables(path, variables)
    : [path, variables];
  const params = convertVariablesToQueryParams(newVariables);
  const axiosSecure = getTMDBAxiosInstance();
  const response = await axiosSecure.get<TResponse>(`${urlPath}${params}`, { signal });
  return response.data;
}

export async function tmdbPostFn<TResponse, TVariables>(
  path: string,
  options: MutationFnOptions<TVariables>,
): Promise<TResponse> {
  const { variables, signal } = options;
  const [urlPath, newVariables] = path.includes("[")
    ? getFormattedMutationURLPathAndVariables(path, variables)
    : [path, variables];
  const axiosSecure = getTMDBAxiosInstance();
  const response = await axiosSecure.post<TResponse>(urlPath, newVariables, { signal });
  return response.data;
}

export async function tmdbPutFn<TResponse, TVariables>(path: string, options: MutationFnOptions<TVariables>): Promise<TResponse> {
  const { variables, signal } = options;
  const [urlPath, newVariables] = path.includes("[")
    ? getFormattedMutationURLPathAndVariables(path, variables)
    : [path, variables];
  const axiosSecure = getTMDBAxiosInstance();
  const response = await axiosSecure.put<TResponse>(urlPath, newVariables, { signal });
  return response.data;
}

export async function tmdbDeleteFn<TResponse, TVariables>(
  path: string,
  options: MutationFnOptions<TVariables>,
): Promise<TResponse> {
  const { variables, signal } = options;
  const [urlPath, newVariables] = path.includes("[")
    ? getFormattedMutationURLPathAndVariables(path, variables)
    : [path, variables];
  const axiosSecure = getTMDBAxiosInstance();
  const response = await axiosSecure.delete<TResponse>(urlPath, { data: newVariables, signal });
  return response.data;
}

export async function tmdbPatchFn<TResponse, TVariables>(
  path: string,
  options: MutationFnOptions<TVariables>,
): Promise<TResponse> {
  const { variables, signal } = options;
  const [urlPath, newVariables] = path.includes("[")
    ? getFormattedMutationURLPathAndVariables(path, variables)
    : [path, variables];
  const axiosSecure = getTMDBAxiosInstance();
  const response = await axiosSecure.patch<TResponse>(urlPath, { data: newVariables, signal });
  return response.data;
}

export function getFormattedMutationURLPathAndVariables<TVariables>(path: string, variables: TVariables): [string, TVariables] {
  const newVariables = Object.assign({}, variables) as TVariables;
  const constructedURLPath = path.split("/").reduce((acc, segment) => {
    if (!segment) return acc;
    const variableKeyPath = segment.includes("[") ? segment.replace("[", "").replace("]", "") : null;
    if (!variableKeyPath) return `${acc}/${segment}`;
    const separatedKeys = variableKeyPath.split(".") as Array<keyof TVariables>;
    const value = separatedKeys.reduce((acc, key) => acc[key], variables as any);
    deleteKeyPathFromObject(newVariables, variableKeyPath);
    return `${acc}${value ? "/" + value : ""}`;
  }, "");

  return [constructedURLPath, newVariables];
}

function deleteKeyPathFromObject<TObj>(obj: TObj, path: string): void {
  let currentObject: any = obj;
  const parts = path.split(".") as Array<keyof TObj>;
  const last = parts.pop() as keyof TObj;
  for (const part of parts) {
    currentObject = currentObject[part];
    if (!currentObject) return;
  }
  delete currentObject[last];
}
