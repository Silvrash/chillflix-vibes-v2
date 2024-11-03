import axios from "axios";
import { StreamingService } from "./streaming.service";

export interface VidSrcTvShow {
  embed_url_imdb: string;
  embed_url_tmdb: string;
  imdb_id: string;
  number: number;
  season: number;
  title: string;
  tmdb_id: string;
  type: string;
}

export interface VidSrcResponse<T> {
  status: number;
  result: {
    page: number;
    items: T[];
  };
}

export interface VidSrcMovie {
  type: string;
  title: string;
  imdb_id: string;
  embed_url_imdb: string;
  tmdb_id: string;
  embed_url_tmdb: string;
}

export class VidSrcTo extends StreamingService<VidSrcResponse<VidSrcMovie>, VidSrcResponse<VidSrcTvShow>> {
  activeDomain = "vidsrc.to";
  domains = [this.activeDomain];

  getMovieLink(tmdbId: number) {
    return `https://${this.activeDomain}/embed/movie/${tmdbId}?ds_lang=${this.language}`;
  }

  getEpisodeLink(tmdbId: number, season: number, ep: number) {
    return `https://${this.activeDomain}/embed/tv/${tmdbId}/${season}/${ep}?ds_lang=${this.language}`;
  }

  async getLatestMovies(page: number) {
    return axios.get<VidSrcResponse<VidSrcMovie>>(`https://vidsrc.to/vapi/movie/new/${page}`);
  }

  async getLatestTvShows(page: number) {
    return axios.get<VidSrcResponse<VidSrcTvShow>>(`https://vidsrc.to/vapi/episode/latest/${page}`);
  }
}
