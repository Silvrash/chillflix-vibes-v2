import {
	InfiniteData,
	QueryClient,
	UseInfiniteQueryOptions,
	UseMutationOptions,
	UseQueryOptions,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { uniqBy } from 'ramda';
import { tmdbDeleteFn, tmdbGetFn, tmdbPatchFn, tmdbPostFn, tmdbPutFn } from './tmdb-client';

export type Maybe<T> = T | undefined | null;
export type ApiRequestResult<TData = any> = TData;

export type GetQueryOptions<TResponse, TVariables, TData = TResponse, TError = unknown> = UseQueryOptions<
	TResponse,
	AxiosError<TError>,
	TData,
	[string, TVariables | undefined]
> & {
	variables?: TVariables;
};

export function getQuery<TResponse, TVariables, TData = TResponse>(
	path: string,
): (o?: Partial<GetQueryOptions<TResponse, TVariables, TData>>) => GetQueryOptions<TResponse, TVariables, TData> {
	return (options) => {
		return {
			queryKey: [path, options?.variables],
			queryFn: async ({ signal }) => {
				return tmdbGetFn<TResponse, TVariables>(path, { signal, variables: options?.variables });
			},
			...options,
		};
	};
}

export type GetInfiniteQueryOptions<
	TResponse,
	TVariables,
	TData = InfiniteData<TResponse>,
	TError = unknown,
> = UseInfiniteQueryOptions<TResponse, AxiosError<TError>, TData> & {
	variables?: TVariables;
};

export function getInfiniteQuery<TResponse, TVariables, TData = InfiniteData<TResponse>>(
	path: string,
): (
	o: Omit<GetInfiniteQueryOptions<TResponse, TVariables, TData>, 'queryKey' | 'queryFn'>,
) => GetInfiniteQueryOptions<TResponse, TVariables, TData> {
	return (options) => {
		return {
			queryKey: [path, options?.variables],
			queryFn: async ({ signal, pageParam = 1 }) => {
				return tmdbGetFn<TResponse, TVariables | { page: number }>(path, {
					signal,
					variables: { ...options?.variables, page: pageParam as number },
				});
			},
			...options,
		};
	};
}

export interface GetLazyQueryOptions<TResponse, TVariables, TError = unknown>
	extends UseMutationOptions<TResponse, AxiosError<TError>, TVariables> {
	variables?: TVariables;
	axios?: { baseUrl?: string };
}

export function getLazyQuery<TResponse, TVariables>(
	path: string,
): (o?: GetLazyQueryOptions<TResponse, TVariables>) => GetLazyQueryOptions<TResponse, TVariables> {
	return (options) => {
		return {
			mutationFn: async (variables) => {
				return tmdbGetFn<TResponse, TVariables>(path, { variables });
			},
			...options,
		};
	};
}

export interface MutationQueryOptions<TResponse, TVariables, TError = unknown>
	extends UseMutationOptions<TResponse, AxiosError<TError>, TVariables> {
	axios?: { baseUrl?: string };
}

export function postMutation<TResponse, TVariables>(
	path: string,
): (
	o?: Omit<MutationQueryOptions<TResponse, TVariables>, 'mutationFn'>,
) => MutationQueryOptions<TResponse, TVariables> {
	return (options) => {
		return {
			mutationFn: async (variables) => {
				return tmdbPostFn<TResponse, TVariables>(path, { variables });
			},
			...options,
		};
	};
}

export function putMutation<TResponse, TVariables>(
	path: string,
): (
	o?: Omit<MutationQueryOptions<TResponse, TVariables>, 'mutationFn'>,
) => MutationQueryOptions<TResponse, TVariables> {
	return (options) => {
		return {
			mutationFn: async (variables) => {
				return tmdbPutFn<TResponse, TVariables>(path, { variables });
			},
			...options,
		};
	};
}

export function patchMutation<TResponse, TVariables>(
	path: string,
): (
	o?: Omit<MutationQueryOptions<TResponse, TVariables>, 'mutationFn'>,
) => MutationQueryOptions<TResponse, TVariables> {
	return (options) => {
		return {
			mutationFn: async (variables) => {
				return tmdbPatchFn<TResponse, TVariables>(path, { variables });
			},
			...options,
		};
	};
}

export function deleteMutation<TResponse, TVariables>(
	path: string,
): (
	o?: Omit<MutationQueryOptions<TResponse, TVariables>, 'mutationFn'>,
) => MutationQueryOptions<TResponse, TVariables> {
	return (options) => {
		return {
			mutationFn: async (variables) => {
				return tmdbDeleteFn<TResponse, TVariables>(path, { variables });
			},
			...options,
		};
	};
}

export function partialTMDBFn<TResponse, TVariables, TFunc extends Function>(path: string, fn: TFunc) {
	return (v?: TVariables) => fn(path, v);
}

export type TPageSize<T> = T & { page_size?: number; page?: number };
export type TMDBResponse<T> = {
	page: number;
	total_results: number;
	total_pages: number;
	results: T[];
};

export async function getPaginatedResultsFn<TVariables, TDataItem, T extends (...args: any[]) => any>(
	variables: TPageSize<TVariables>,
	queryFn: T,
	signal?: AbortSignal,
	queryClient?: QueryClient,
) {
	const page = variables.page ?? 1;
	const pageSize = variables.page_size ?? 21;

	const fetch20 = async (page: number): Promise<TMDBResponse<TDataItem>> => {
		const queryKey = (queryFn as any)({ variables: { ...variables, page } }).queryKey;
		const fn = (queryFn as any)({ variables: { ...variables, page } }).queryFn!;

		if (typeof fn !== 'function') throw new Error('queryFn is not a function');

		if (queryClient)
			return queryClient?.fetchQuery({
				queryKey,
				queryFn: (args) => fn({ ...args, signal: signal ?? args.signal }),
			}) as any;

		return fn({ signal });
	};

	let result: TMDBResponse<TDataItem> = { page, results: [], total_pages: 0, total_results: 0 };
	let isFirstRequest = true;
	let currentPage = 1;

	// Fetch pages until we have enough items
	while (result.results.length < pageSize) {
		const overlap = page - 1;

		let itemsProcessed = result.results.length;

		const remainingItems = pageSize - itemsProcessed;
		let itemsToFetch = Math.min(20, remainingItems);

		// Fetch the page
		const pageItems = await fetch20(page + currentPage - 1);
		result.total_pages = Math.ceil(pageItems.total_results / pageSize);
		result.total_results = pageItems.total_results;

		// If there are no more items, break out of the loop
		if (pageItems.results.length === 0) break;

		// If this is not the first page, remove the overlapping items from the previous page
		if (isFirstRequest && page > 1 && overlap > 0 && pageSize > 20) {
			pageItems.results.splice(0, overlap);
			isFirstRequest = false;
		}

		// Append items to the result
		result.results = result.results.concat(pageItems.results.slice(0, itemsToFetch));

		result.results = uniqBy((item) => (item as any).id, result.results);

		currentPage++;
	}

	return result;
}
