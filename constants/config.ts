const presets = {
  moviePresets: [
    {
      name: "Recommended Movies",
      filters: {
        sort_by: "popularity.desc",
        "vote_average.gte": 7.5,
        "vote_count.gte": 250,
        "popularity.lte": 500,
        "primary_release_date.gte": `${new Date().getFullYear() - 5}-01-01`,
      },
    },
    {
      name: "Popular New Releases",
      filters: {
        sort_by: "popularity.desc",
        "primary_release_date.gte": `${new Date().getFullYear()}-01-01`,
        "vote_count.gte": 500,
      },
    },
    {
      name: "Top Rated Classics",
      filters: {
        sort_by: "vote_average.desc",
        "primary_release_date.lte": `${new Date().getFullYear() - 23}-12-31`,
        "vote_count.gte": 1000,
      },
    },
    {
      name: "Family-Friendly Movies",
      filters: {
        with_genres: "10751",
        certification_country: "US",
        "certification.lte": "PG",
        sort_by: "popularity.desc",
      },
    },
    {
      name: "Underrated Hidden Gems",
      filters: {
        sort_by: "vote_average.desc",
        "vote_count.lte": 100,
        "primary_release_date.gte": `${new Date().getFullYear() - 13}-01-01`,
      },
    },
    {
      name: "Action-Packed Thrillers",
      filters: {
        with_genres: "28,53",
        sort_by: "popularity.desc",
        "vote_count.gte": 200,
      },
    },
    {
      name: "Romantic Comedies",
      filters: {
        with_genres: "10749,35",
        sort_by: "release_date.desc",
        "primary_release_date.gte": `${new Date().getFullYear() - 23}-01-01`,
      },
    },
    {
      name: "Horror Movies for the Brave",
      filters: {
        with_genres: "27",
        "vote_average.gte": 6.0,
        sort_by: "vote_count.desc",
        "primary_release_date.gte": "1980-01-01",
      },
    },
    {
      name: "Animated Blockbusters",
      filters: {
        with_genres: "16",
        sort_by: "revenue.desc",
        "primary_release_date.gte": "1995-01-01",
      },
    },
    {
      name: "Critically Acclaimed Documentaries",
      filters: {
        with_genres: "99",
        sort_by: "vote_average.desc",
        "vote_count.gte": 200,
      },
    },
    {
      name: "Epic Sci-Fi Adventures",
      filters: {
        with_genres: "878",
        sort_by: "popularity.desc",
        "vote_count.gte": 300,
        "primary_release_date.gte": `${new Date().getFullYear() - 23}-01-01`,
      },
    },
  ],
  tvPresets: [
    {
      name: "Recommended TV Shows",
      filters: {
        sort_by: "popularity.desc",
        "vote_average.gte": 7.5,
        "vote_count.gte": 100,
        "popularity.lte": 500,
        "first_air_date.gte": `${new Date().getFullYear() - 5}-01-01`,
      },
    },
    {
      name: "Trending TV Shows",
      filters: {
        sort_by: "popularity.desc",
        "first_air_date.lte": `${new Date().getFullYear()}-01-01`,
        "vote_count.gte": 500,
      },
    },
    {
      name: "Classic TV Hits",
      filters: {
        sort_by: "vote_average.desc",
        "first_air_date.lte": `${new Date().getFullYear() - 23}-12-31`,
        "vote_count.gte": 100,
      },
    },
    {
      name: "Family TV Shows",
      filters: {
        with_genres: "10751",
        certification_country: "US",
        "certification.lte": "PG",
        sort_by: "popularity.desc",
      },
    },
    {
      name: "Hidden Gem Series",
      filters: {
        sort_by: "vote_average.desc",
        "vote_count.lte": 100,
        "first_air_date.gte": `${new Date().getFullYear() - 13}-01-01`,
      },
    },
    {
      name: "Thrilling Action Shows",
      filters: {
        with_genres: "10759,80",
        sort_by: "popularity.desc",
        "vote_count.gte": 200,
      },
    },
    {
      name: "Romantic Comedies on TV",
      filters: {
        with_genres: "10749,35",
        sort_by: "first_air_date.desc",
        "first_air_date.gte": `${new Date().getFullYear() - 23}-01-01`,
      },
    },
    {
      name: "Chilling Horror Shows",
      filters: {
        with_genres: "9648,80",
        "vote_average.gte": 6.0,
        sort_by: "vote_count.desc",
        "first_air_date.gte": "1980-01-01",
      },
    },
    {
      name: "Popular Animated TV Shows",
      filters: {
        with_genres: "16",
        sort_by: "popularity.desc",
        "first_air_date.gte": "1995-01-01",
      },
    },
    {
      name: "Insightful Documentary Series",
      filters: {
        with_genres: "99",
        sort_by: "vote_average.desc",
        "vote_count.gte": 200,
      },
    },
    {
      name: "Epic Sci-Fi TV Shows",
      filters: {
        with_genres: "10765",
        sort_by: "popularity.desc",
        "vote_count.gte": 300,
        "first_air_date.gte": `${new Date().getFullYear() - 23}-01-01`,
      },
    },
  ],
};

export const Config = {
  STORAGE_KEYS: {
    JWT_TOKEN: "dfaiehSauifheuaijeaf",
  },
  TMDB: {
    BASE_URL: "https://api.themoviedb.org/3",
    API_KEY:
      "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MWZhNTkxNTg2MTEzN2YzYjc5NTMzZTI3OGFiZmQ1YSIsInN1YiI6IjViMGIzNTc3MGUwYTI2MGUwZjAwZDNmNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.V9_2wJ1cTruatkthBFpUdeAFYYNYPyA28PhgZWC6N4o",
  },
  presets,
};
