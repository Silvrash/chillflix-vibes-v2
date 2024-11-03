import { Config } from '@/constants/config';
import axios from 'axios';

export async function getTMDBAxiosInstance(baseUrl?: string) {
	const token = Config.TMDB.API_KEY;

	if (!token) throw new Error('Attempting to securely connect to api when there is no token!');

	const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

	return axios.create({
		baseURL: baseUrl ?? Config.TMDB.BASE_URL,
		headers,
	});
}
export const ANIME_FILTERS = {
	with_genres: '16',
	with_w342_language: 'ja',
	language: undefined,
};

export function getTMDBImageUrl(path: string, imageSize = 'w342'): string {
	const baseImageUrl = 'https://image.tmdb.org/t/p/';

	return baseImageUrl + imageSize + path;
}

export function getTMDBGenre(genreId: number) {
	const genres = [
		{ id: 28, name: 'Action' },
		{ id: 12, name: 'Adventure' },
		{ id: 16, name: 'Animation' },
		{ id: 35, name: 'Comedy' },
		{ id: 80, name: 'Crime' },
		{ id: 99, name: 'Documentary' },
		{ id: 18, name: 'Drama' },
		{ id: 10751, name: 'Family' },
		{ id: 14, name: 'Fantasy' },
		{ id: 36, name: 'History' },
		{ id: 27, name: 'Horror' },
		{ id: 10402, name: 'Music' },
		{ id: 9648, name: 'Mystery' },
		{ id: 10749, name: 'Romance' },
		{ id: 878, name: 'Science Fiction' },
		{ id: 10770, name: 'TV Movie' },
		{ id: 53, name: 'Thriller' },
		{ id: 10752, name: 'War' },
		{ id: 37, name: 'Western' },
		{ id: 10759, name: 'Action & Adventure' },
		{ id: 10762, name: 'Kids' },
		{ id: 10763, name: 'News' },
		{ id: 10764, name: 'Reality' },
		{ id: 10765, name: 'Sci-Fi & Fantasy' },
		{ id: 10766, name: 'Soap' },
		{ id: 10767, name: 'Talk' },
		{ id: 10768, name: 'War & Politics' },
	];

	const genre = genres.find((genre) => genre.id === genreId);
	return genre?.name;
}

export function convertGenreIdsToName(genre_ids: number[]): string {
	return genre_ids.reduce((acc, id, i) => {
		const name = getTMDBGenre(id);
		if (!name) return acc;

		acc = acc + name;
		if (i !== genre_ids.length - 1) {
			acc += ', ';
		}
		return acc;
	}, '');
}

function convertVariablesToQueryParams<TVariables>(variables?: TVariables) {
	if (!variables) return '';
	const params = new URLSearchParams(variables).toString();
	if (!params) return '';
	return `?${params}`;
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

export async function tmdbGetFn<TResponse, TVariables>(
	path: string,
	options: QueryFnOptions<TVariables>,
): Promise<TResponse> {
	let { variables, signal, page } = options;

	if (page && variables) {
		variables = { ...variables, page: page };
	}

	const [urlPath, newVariables] = path.includes('[')
		? getFormattedMutationURLPathAndVariables(path, variables)
		: [path, variables];
	const params = convertVariablesToQueryParams(newVariables);
	const axiosSecure = await getTMDBAxiosInstance();
	const response = await axiosSecure.get<TResponse>(`${urlPath}${params}`, { signal });
	return response.data;
}

export async function tmdbPostFn<TResponse, TVariables>(
	path: string,
	options: MutationFnOptions<TVariables>,
): Promise<TResponse> {
	const { variables, signal } = options;
	const [urlPath, newVariables] = path.includes('[')
		? getFormattedMutationURLPathAndVariables(path, variables)
		: [path, variables];
	const axiosSecure = await getTMDBAxiosInstance();
	const response = await axiosSecure.post<TResponse>(urlPath, newVariables, { signal });
	return response.data;
}

export async function tmdbPutFn<TResponse, TVariables>(
	path: string,
	options: MutationFnOptions<TVariables>,
): Promise<TResponse> {
	const { variables, signal } = options;
	const [urlPath, newVariables] = path.includes('[')
		? getFormattedMutationURLPathAndVariables(path, variables)
		: [path, variables];
	const axiosSecure = await getTMDBAxiosInstance();
	const response = await axiosSecure.put<TResponse>(urlPath, newVariables, { signal });
	return response.data;
}

export async function tmdbDeleteFn<TResponse, TVariables>(
	path: string,
	options: MutationFnOptions<TVariables>,
): Promise<TResponse> {
	const { variables, signal } = options;
	const [urlPath, newVariables] = path.includes('[')
		? getFormattedMutationURLPathAndVariables(path, variables)
		: [path, variables];
	const axiosSecure = await getTMDBAxiosInstance();
	const response = await axiosSecure.delete<TResponse>(urlPath, { data: newVariables, signal });
	return response.data;
}

export async function tmdbPatchFn<TResponse, TVariables>(
	path: string,
	options: MutationFnOptions<TVariables>,
): Promise<TResponse> {
	const { variables, signal } = options;
	const [urlPath, newVariables] = path.includes('[')
		? getFormattedMutationURLPathAndVariables(path, variables)
		: [path, variables];
	const axiosSecure = await getTMDBAxiosInstance();
	const response = await axiosSecure.patch<TResponse>(urlPath, { data: newVariables, signal });
	return response.data;
}

export function getFormattedMutationURLPathAndVariables<TVariables>(
	path: string,
	variables: TVariables,
): [string, TVariables] {
	const newVariables = Object.assign({}, variables) as TVariables;
	const constructedURLPath = path.split('/').reduce((acc, segment) => {
		if (!segment) return acc;
		const variableKeyPath = segment.includes('[') ? segment.replace('[', '').replace(']', '') : null;
		if (!variableKeyPath) return `${acc}/${segment}`;
		const separatedKeys = variableKeyPath.split('.') as Array<keyof TVariables>;
		const value = separatedKeys.reduce((acc, key) => acc[key], variables as any);
		deleteKeyPathFromObject(newVariables, variableKeyPath);
		return `${acc}${value ? '/' + value : ''}`;
	}, '');

	return [constructedURLPath, newVariables];
}

function deleteKeyPathFromObject<TObj>(obj: TObj, path: string): void {
	let currentObject: any = obj;
	const parts = path.split('.') as Array<keyof TObj>;
	const last = parts.pop() as keyof TObj;
	for (const part of parts) {
		currentObject = currentObject[part];
		if (!currentObject) return;
	}
	delete currentObject[last];
}
