import axios from "axios";
import { StreamingService } from "./streaming.service";

export interface VidSrcMeTvShow {
  imdb_id: string;
  tmdb_id: string;
  show_title: string;
  season: string;
  episode: string;
  embed_url: string;
  embed_url_tmdb: string;
  quality: string;
}

export interface VidSrcResponse<T> {
  result: T[];
  pages: number;
}

export interface VidSrcMeMovie {
  imdb_id: string;
  tmdb_id: string;
  title: string;
  embed_url: string;
  embed_url_tmdb: string;
  quality: string;
}

export class VidSrcMe extends StreamingService<VidSrcResponse<VidSrcMeMovie>, VidSrcResponse<VidSrcMeTvShow>> {
  domains = ["vidsrc.me", "vidsrc.xyz", "vidsrc.in", "vidsrc.pm", "vidsrc.net"];

  getMovieLink(tmdbId: number | string) {
    const domain = this.activeDomain ?? this.domains[0];
    return `https://${domain}/embed/movie?tmdb=${tmdbId}&ds_lang=${this.language}`;
  }

  getEpisodeLink(tmdbId: number | string, season: number | string, ep: number | string) {
    const domain = this.activeDomain ?? this.domains[0];
    return `https://${domain}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${ep}&ds_lang=${this.language}`;
  }
  async getLatestMovies(page: number | string) {
    const domain = this.activeDomain ?? this.domains[0];

    return axios.get<VidSrcResponse<VidSrcMeMovie>>(`https://${domain}/movies/latest/page-${page}.json`);
  }

  async getLatestTvShows(page: number | string) {
    const domain = this.activeDomain ?? this.domains[0];

    return axios.get<VidSrcResponse<VidSrcMeTvShow>>(`https://${domain}/tvshows/latest/page-${page}.json`);
  }
}
