
/* =========================================================
   CineScope: TMDB Movie Discovery SPA
   Technologies: HTML, CSS, JavaScript, jQuery, AJAX, JSON
   Features: Popular movies, search, suggestions, genres,
   sorting, pagination, movie details and saved watchlist.
   ========================================================= */

(function ($) {
  "use strict";

  const API_BASE = "https://api.themoviedb.org/3";
  const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

  // Your TMDB API key
  const API_KEY = "1563ac471ff1e352d4d49c3e8b510fcc";

  const STORAGE_KEY = "cinescope_watchlist_v1";

  let currentPage = 1;
  let totalPages = 1;
  let currentView = "home";
  let currentQuery = "";
  let currentGenre = "";
  let currentSort = "popularity.desc";
  let requestSequence = 0;
  let suggestionTimer = null;
  let lastFocusedElement = null;

  let watchlist = readWatchlist();
  let genres = [];

  // Store movie records for the watchlist and details dialog.
  const movieCache = {};

  function readWatchlist() {
    try {
      const stored = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      return [];
    }
  }

  function saveWatchlist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(watchlist)
      );

      updateWatchlistCount();
    } catch (error) {
      showStatus(
        "Unable to save your watchlist. Check browser storage settings.",
        true
      );
    }
  }

  function updateWatchlistCount() {
    $("#watchlist-count").text(watchlist.length);
  }

  function hasSaved(id) {
    return watchlist.some(function (movie) {
      return Number(movie.id) === Number(id);
    });
  }

  function getTitle(movie) {
    return movie.title || movie.name || "Untitled movie";
  }

  function getYear(date) {
    return date && date.length >= 4
      ? date.substring(0, 4)
      : "Year unknown";
  }

  function getPoster(path) {
    return path ? IMAGE_BASE + path : "";
  }

  // Make a request to the TMDB API.
  function apiRequest(path, params) {
    return $.ajax({
      url: API_BASE + path,
      method: "GET",
      dataType: "json",
      timeout: 15000,
      data: $.extend({}, params || {}, {
        api_key: API_KEY,
        language: "en-US"
      })
    });
  }

  function showStatus(message, isError) {
    $("#status-message")
      .text(message)
      .toggleClass("error", Boolean(isError))
      .prop("hidden", false);
  }

  function hideStatus() {
    $("#status-message")
      .prop("hidden", true)
      .removeClass("error");
  }

  function setLoading(message) {
    $("#movie-grid").empty();
    $("#pagination").prop("hidden", true);
    showStatus(message || "Loading movies...", false);
  }

  function updateHeading(title, eyebrow) {
    $("#section-title").text(title);
    $("#section-eyebrow").text(
      eyebrow || "CURATED FOR YOU"
    );
  }

  // Load movie genres from TMDB.
  function loadGenres() {
    return apiRequest("/genre/movie/list", {})
      .done(function (data) {
        genres = data.genres || [];

        const $select = $("#genre-filter");

        $select.find("option:not(:first)").remove();

        genres.forEach(function (genre) {
          $("<option>")
            .val(genre.id)
            .text(genre.name)
            .appendTo($select);
        });
      });
  }

  // Load movies based on the selected view and filters.
  function loadMovies() {
    if (currentView === "watchlist") {
      updateHeading(
        "My Watchlist",
        "YOUR SAVED COLLECTION"
      );

      $("#result-count").text(
        watchlist.length + " saved movies"
      );

      renderMovies(watchlist);
      updatePagination();
      return;
    }

    const sequence = ++requestSequence;

    setLoading("Loading movies...");

    let path;
    const params = {
      page: currentPage
    };

    if (currentQuery) {
      path = "/search/movie";
      params.query = currentQuery;
      params.include_adult = false;

      updateHeading(
        'Search results for "' + currentQuery + '"',
        "MOVIE SEARCH"
      );
    } else if (
      currentGenre ||
      currentSort !== "popularity.desc"
    ) {
      path = "/discover/movie";
      params.sort_by = currentSort;

      if (currentGenre) {
        params.with_genres = currentGenre;
      }

      updateHeading("Explore Movies", "DISCOVER");
    } else {
      path = "/movie/popular";

      updateHeading(
        "Popular Right Now",
        "CURATED FOR YOU"
      );
    }

    apiRequest(path, params)
      .done(function (data) {
        if (sequence !== requestSequence) return;

        totalPages = Math.max(
          1,
          Math.min(Number(data.total_pages) || 1, 500)
        );

        currentPage = Number(data.page) || 1;

        $("#result-count").text(
          (Number(data.total_results) || 0).toLocaleString() +
          " movies found"
        );

        renderMovies(data.results || []);
        updatePagination();
      })
      .fail(function (xhr, status) {
        if (sequence !== requestSequence) return;

        let message =
          "Could not load movies. Check your internet connection.";

        if (status === "timeout") {
          message =
            "The request timed out. Please try again.";
        } else if (xhr.status === 401) {
          message =
            "TMDB rejected the API key. Check your v3 API key.";
        } else if (xhr.status === 403) {
          message =
            "TMDB denied access. Check your API permissions.";
        } else if (xhr.status === 429) {
          message =
            "Too many requests. Wait a moment and try again.";
        }

        showStatus(message, true);
      });
  }

  // Display the movie cards.
  function renderMovies(movies) {
    const $grid = $("#movie-grid").empty();

    if (!movies.length) {
      hideStatus();

      showStatus(
        currentView === "watchlist"
          ? "Your watchlist is empty. Add movies to save them here."
          : "No movies found. Try another title or filter.",
        false
      );

      $("#result-count").text(
        currentView === "watchlist"
          ? "0 saved movies"
          : "0 results"
      );

      $("#pagination").prop("hidden", true);
      return;
    }

    hideStatus();

    movies.forEach(function (movie) {
      movieCache[movie.id] = movie;

      const title = getTitle(movie);
      const image = getPoster(movie.poster_path);
      const rating = Number(movie.vote_average);

      const ratingLabel =
        rating > 0
          ? rating.toFixed(1) + "/10"
          : "Not rated";

      const saved = hasSaved(movie.id);

      const $card = $("<article>")
        .addClass("movie-card");

      const $posterWrap = $("<div>")
        .addClass("poster-wrap");

      if (image) {
        $("<img>")
          .addClass("poster")
          .attr({
            src: image,
            alt: "Poster for " + title,
            loading: "lazy"
          })
          .on("error", function () {
            $(this).replaceWith(
              $("<div>")
                .addClass("poster-placeholder")
                .text("Poster unavailable")
            );
          })
          .appendTo($posterWrap);
      } else {
        $("<div>")
          .addClass("poster-placeholder")
          .text("Poster unavailable")
          .appendTo($posterWrap);
      }

      const $body = $("<div>")
        .addClass("card-body");

      $("<h3>")
        .addClass("card-title")
        .text(title)
        .appendTo($body);

      const $meta = $("<div>")
        .addClass("card-meta");

      $("<span>")
        .text(getYear(movie.release_date))
        .appendTo($meta);

      $("<span>")
        .addClass("rating")
        .text("★ " + ratingLabel)
        .appendTo($meta);

      $meta.appendTo($body);

      const $actions = $("<div>")
        .addClass("card-actions");

      $("<button>")
        .attr({
          type: "button",
          "data-action": "details",
          "data-id": movie.id
        })
        .addClass("details-button")
        .text("View Details")
        .appendTo($actions);

      $("<button>")
        .attr({
          type: "button",
          "data-action": "toggle-save",
          "data-id": movie.id,
          "aria-pressed": String(saved)
        })
        .addClass("save-button")
        .text(saved ? "✓ Saved" : "+ Watchlist")
        .appendTo($actions);

      $actions.appendTo($body);

      $card.append($posterWrap, $body)
        .appendTo($grid);
    });
  }

  function updatePagination() {
    const isWatchlist = currentView === "watchlist";

    $("#pagination").prop(
      "hidden",
      isWatchlist || totalPages <= 1
    );

    $("#page-label").text(
      "Page " + currentPage + " of " + totalPages
    );

    $("#previous-page").prop(
      "disabled",
      currentPage <= 1
    );

    $("#next-page").prop(
      "disabled",
      currentPage >= totalPages
    );
  }

  // Switch between Home and Watchlist.
  function setView(view) {
    currentView = view;

    $(".nav-button")
      .removeClass("active")
      .filter('[data-view="' + view + '"]')
      .addClass("active");

    const isWatchlist = view === "watchlist";

    $(".hero").toggle(!isWatchlist);
    $(".filters").toggle(!isWatchlist);
    $("#result-count").toggle(!isWatchlist);

    currentPage = 1;

    if (isWatchlist) {
      updateHeading(
        "My Watchlist",
        "YOUR SAVED COLLECTION"
      );

      $("#result-count").text(
        watchlist.length + " saved movies"
      );

      renderMovies(watchlist);
      updatePagination();
    } else {
      currentQuery = $("#search-input").val().trim();
      loadMovies();
    }
  }

  // Add or remove a movie from the watchlist.
  function toggleWatchlist(movie) {
    if (!movie) return;

    const id = Number(movie.id);

    if (hasSaved(id)) {
      watchlist = watchlist.filter(function (item) {
        return Number(item.id) !== id;
      });
    } else {
      watchlist.push({
        id: id,
        title: getTitle(movie),
        release_date: movie.release_date || "",
        poster_path: movie.poster_path || "",
        vote_average: movie.vote_average || 0,
        overview: movie.overview || ""
      });
    }

    saveWatchlist();

    if (currentView === "watchlist") {
      $("#result-count").text(
        watchlist.length + " saved movies"
      );

      renderMovies(watchlist);
      updatePagination();
    } else {
      const saved = hasSaved(id);

      $('.save-button[data-id="' + id + '"]')
        .attr("aria-pressed", String(saved))
        .text(saved ? "✓ Saved" : "+ Watchlist");
    }

    const $dialogButton = $(
      '#dialog-content button[data-action="toggle-save"]'
    );

    if (Number($dialogButton.attr("data-id")) === id) {
      const saved = hasSaved(id);

      $dialogButton
        .attr("aria-pressed", String(saved))
        .text(
          saved
            ? "✓ Saved to Watchlist"
            : "+ Add to Watchlist"
        );
    }
  }

  // Show detailed movie information.
  function openMovieDetails(movieId, triggerElement) {
    lastFocusedElement =
      triggerElement || document.activeElement;

    $("#dialog-content")
      .empty()
      .append(
        $("<p>").text("Loading movie details...")
      );

    $("#movie-dialog").prop("hidden", false);
    $("#close-dialog").trigger("focus");

    apiRequest(
      "/movie/" + encodeURIComponent(movieId),
      { append_to_response: "credits" }
    )
      .done(function (movie) {
        movieCache[movie.id] = movie;

        const title = getTitle(movie);
        const image = getPoster(movie.poster_path);

        const genreText = (movie.genres || [])
          .map(function (genre) {
            return genre.name;
          })
          .join(", ");

        const cast =
          movie.credits && movie.credits.cast
            ? movie.credits.cast
                .slice(0, 5)
                .map(function (person) {
                  return person.name;
                })
                .join(", ")
            : "";

        const $layout = $("<div>")
          .addClass("detail-layout");

        if (image) {
          $("<img>")
            .addClass("detail-poster")
            .attr({
              src: image,
              alt: "Poster for " + title
            })
            .appendTo($layout);
        } else {
          $("<div>")
            .addClass("poster-placeholder")
            .text("Poster unavailable")
            .appendTo($layout);
        }

        const $copy = $("<div>")
          .addClass("detail-copy");

        $("<p>")
          .addClass("eyebrow")
          .text("MOVIE DETAILS")
          .appendTo($copy);

        $("<h2>")
          .attr("id", "dialog-title")
          .text(title)
          .appendTo($copy);

        const facts = [
          getYear(movie.release_date),
          movie.runtime
            ? movie.runtime + " min"
            : "",
          movie.vote_average
            ? "★ " +
              Number(movie.vote_average).toFixed(1) +
              "/10"
            : ""
        ].filter(Boolean).join(" • ");

        $("<p>")
          .addClass("detail-facts")
          .text(facts)
          .appendTo($copy);

        $("<p>")
          .text(genreText || "Genres not available")
          .appendTo($copy);

        $("<h3>")
          .text("Overview")
          .appendTo($copy);

        $("<p>")
          .addClass("detail-overview")
          .text(
            movie.overview ||
            "No overview is available for this movie."
          )
          .appendTo($copy);

        $("<h3>")
          .text("Cast")
          .appendTo($copy);

        $("<p>")
          .addClass("detail-overview")
          .text(cast || "Cast information is unavailable.")
          .appendTo($copy);

        $("<button>")
          .addClass("primary-button")
          .attr({
            type: "button",
            "data-action": "toggle-save",
            "data-id": movie.id,
            "aria-pressed": String(hasSaved(movie.id))
          })
          .text(
            hasSaved(movie.id)
              ? "✓ Saved to Watchlist"
              : "+ Add to Watchlist"
          )
          .appendTo($copy);

        $layout.append($copy);

        $("#dialog-content")
          .empty()
          .append($layout);
      })
      .fail(function () {
        $("#dialog-content")
          .empty()
          .append(
            $("<p>").text(
              "Movie details could not be loaded. Try again."
            )
          );
      });
  }

  function closeDialog() {
    $("#movie-dialog").prop("hidden", true);
    $("#dialog-content").empty();

    if (
      lastFocusedElement &&
      document.contains(lastFocusedElement)
    ) {
      lastFocusedElement.focus();
    }
  }

  // Show suggestions while the user types.
  function loadSuggestions(query) {
    if (!query || query.length < 2) {
      $("#suggestions")
        .prop("hidden", true)
        .empty();

      return;
    }

    apiRequest("/search/movie", {
      query: query,
      page: 1,
      include_adult: false
    }).done(function (data) {
      if ($("#search-input").val().trim() !== query) {
        return;
      }

      const $suggestions = $("#suggestions").empty();

      (data.results || [])
        .slice(0, 5)
        .forEach(function (movie) {
          $("<button>")
            .addClass("suggestion-option")
            .attr({
              type: "button",
              role: "option",
              "data-id": movie.id,
              "data-title": getTitle(movie)
            })
            .text(
              getTitle(movie) +
              (movie.release_date
                ? " (" + getYear(movie.release_date) + ")"
                : "")
            )
            .appendTo($suggestions);
        });

      $suggestions.prop(
        "hidden",
        !$suggestions.children().length
      );
    });
  }

  // Initialize the application and event handlers.
  function initialize() {
    $("#current-year").text(
      new Date().getFullYear()
    );

    updateWatchlistCount();

    loadGenres()
      .always(function () {
        loadMovies();
      });

    // Search form.
    $("#search-form").on("submit", function (event) {
      event.preventDefault();

      currentQuery = $("#search-input").val().trim();
      currentPage = 1;
      currentView = "home";

      $(".nav-button")
        .removeClass("active")
        .filter('[data-view="home"]')
        .addClass("active");

      $(".hero, .filters, #result-count").show();

      $("#suggestions").prop("hidden", true);

      loadMovies();
    });

    // Search suggestions.
    $("#search-input").on("input", function () {
      const query = $(this).val().trim();

      clearTimeout(suggestionTimer);

      suggestionTimer = setTimeout(function () {
        loadSuggestions(query);
      }, 300);
    });

    $("#suggestions").on(
      "click",
      ".suggestion-option",
      function () {
        $("#search-input").val($(this).data("title"));
        $("#search-form").trigger("submit");
      }
    );

    $(document).on("click", function (event) {
      if (!$(event.target).closest(".search-form").length) {
        $("#suggestions").prop("hidden", true);
      }
    });

    // Navigation.
    $(".nav-button").on("click", function () {
      setView($(this).data("view"));
    });

    // Genre filtering.
    $("#genre-filter").on("change", function () {
      currentGenre = $(this).val();
      currentQuery = "";
      currentPage = 1;
      currentView = "home";

      $("#search-input").val("");

      loadMovies();
    });

    // Sorting.
    $("#sort-filter").on("change", function () {
      currentSort = $(this).val();
      currentQuery = "";
      currentPage = 1;
      currentView = "home";

      $("#search-input").val("");

      loadMovies();
    });

    // Clear filters.
    $("#clear-filters").on("click", function () {
      currentGenre = "";
      currentSort = "popularity.desc";
      currentQuery = "";
      currentPage = 1;
      currentView = "home";

      $("#genre-filter").val("");
      $("#sort-filter").val("popularity.desc");
      $("#search-input").val("");

      loadMovies();
    });

    // Pagination.
    $("#previous-page").on("click", function () {
      if (currentPage > 1) {
        currentPage--;
        loadMovies();
      }
    });

    $("#next-page").on("click", function () {
      if (currentPage < totalPages) {
        currentPage++;
        loadMovies();
      }
    });

    // Movie details buttons.
    $("#movie-grid").on(
      "click",
      'button[data-action="details"]',
      function () {
        openMovieDetails(
          Number($(this).attr("data-id")),
          this
        );
      }
    );

    // Watchlist buttons on movie cards.
    $("#movie-grid").on(
      "click",
      'button[data-action="toggle-save"]',
      function () {
        const id = Number($(this).attr("data-id"));
        const movie = movieCache[id];

        if (movie) {
          toggleWatchlist(movie);
        }
      }
    );

    // Watchlist button inside the details dialog.
    $("#dialog-content").on(
      "click",
      'button[data-action="toggle-save"]',
      function () {
        const id = Number($(this).attr("data-id"));
        const movie = movieCache[id];

        if (movie) {
          toggleWatchlist(movie);
        }
      }
    );

    // Close the details dialog.
    $("#close-dialog").on("click", closeDialog);

    $("#movie-dialog").on("click", function (event) {
      if (event.target === this) {
        closeDialog();
      }
    });

    // Escape key closes the dialog.
    $(document).on("keydown", function (event) {
      if (
        event.key === "Escape" &&
        !$("#movie-dialog").prop("hidden")
      ) {
        closeDialog();
      }
    });
  }

  $(initialize);

})(jQuery);
