import axios, { AxiosResponse } from "axios";

export abstract class StreamingService<TMovies, TSeries> {
  abstract domains: string[];
  public activeDomain?: string;
  protected language = "en";

  protected async setActiveDomain() {
    for (const domain of this.domains) {
      try {
        const response = await axios.head(`https://${domain}`);
        if (response.status === 200) {
          this.activeDomain = domain;
          return domain;
        }
      } catch (error) {
        continue;
      }
    }
    throw new Error("No active domains found.");
  }

  protected abstract getMovieLink(tmdbId: number): Promise<string> | string;
  protected abstract getEpisodeLink(tmdbId: number, season: 1, ep: number): Promise<string> | string;

  async checkHDAvailable(embedUrl: string) {
    try {
      const response = await axios.get(embedUrl, {
        headers: {},
      });
      console.log(response.data);
      // Parse response to extract video quality information
      // Check if HD is available based on the parsed data
      // Return true or false accordingly
      // Example: return response.data.video_quality === "hd";
    } catch (error) {
      console.error("Error checking HD availability:", error);
      return false;
    }
  }

  abstract getLatestMovies(page: number): Promise<AxiosResponse<TMovies>>;

  abstract getLatestTvShows(page: number): Promise<AxiosResponse<TSeries>>;
}
