import { MediaType } from "@/api/tmdb";
import { useMovieMediaQueries } from "./useMovieMediaQueries";
import { useTvShowMediaQueries } from "./useTvShowMediaQueries";

export function useMediaTypeQueries(id: number, mediaType: MediaType) {
  const movieQuery = useMovieMediaQueries(id, mediaType);
  const tvShowQuery = useTvShowMediaQueries(id, mediaType);
  return mediaType === MediaType.movie ? movieQuery : tvShowQuery;
}
