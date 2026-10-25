/* CineScope - TMDB Movie Discovery SPA
   Uses jQuery AJAX and JSON. Replace the placeholder with your TMDB v3 API key. */
(function ($) {
  "use strict";

  const API_BASE = "https://api.themoviedb.org/3";
  const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
 const PLACEHOLDER_KEY = "1563ac471ff1e352d4d49c3e8b510fcc";
   const STORAGE_KEY = "cinescope_watchlist_v1";

  let apiKey = localStorage.getItem("cinescope_demo_api_key") || PLACEHOLDER_KEY;
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

  function readWatchlist() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveWatchlist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
      updateWatchlistCount();
    } catch (error) {
      showStatus("Your browser could not save the watchlist. Check its storage settings.", true);
    }
  }

  function updateWatchlistCount() {
    $("#watchlist-count").text(watchlist.length);
  }

  function hasSaved(id) {
    return watchlist.some(function (movie) { return Number(movie.id) === Number(id); });
  }

  function apiRequest(path, params) {
    const data = $.extend({}, params || {}, { api_key: apiKey, language: "en-US" });
    return $.ajax({
      url: API_BASE + path,
      method: "GET",
      data: data,
      dataType: "json",
      timeout: 15000
    });
  }

  function showStatus(message, isError) {
    $("#status-message").text(message).toggleClass("error", Boolean(isError)).prop("hidden", false);
  }

  function hideStatus() {
    $("#status-message").prop("hidden", true).removeClass("error");
  }

  function updateHeading(title, eyebrow) {
    $("#section-title").text(title);
    $("#section-eyebrow").text(eyebrow || "CURATED FOR YOU");
  }

  function setLoading(message) {
    $("#movie-grid").empty();
    $("#pagination").prop("hidden", true);
    showStatus(message || "Loading movies…", false);
  }

  function safeText(value, fallback) {
    return value === null || value === undefined || value === "" ? (fallback || "Not available") : String(value);
  }

  function posterUrl(path) {
    return path ? IMAGE_BASE + path : "";
  }

  function getYear(date) {
    return date && date.length >= 4 ? date.slice(0, 4) : "Year unknown";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
    });
  }

  function loadGenres() {
    return apiRequest("/genre/movie/list", {}).done(function (data) {
      genres = data.genres || [];
      const $select = $("#genre-filter");
      genres.forEach(function (genre) {
        $("<option>").val(genre.id).text(genre.name).appendTo($select);
      });
    });
  }

  function loadMovies() {
    if (!apiKey || apiKey === PLACEHOLDER_KEY) {
      setLoading("Add your TMDB API key in app.js to load live movie data.");
      $("#status-message").append(
        $("<p>").text("Open app.js and replace PASTE_YOUR_TMDB_V3_API_KEY_HERE with your TMDB API key.")
      );
      return;
    }

    const sequence = ++requestSequence;
    setLoading("Loading movies…");
    let path;
    let params = { page: currentPage };

    if (currentView === "watchlist") {
      updateHeading("My watchlist", "YOUR SAVED COLLECTION");
      renderMovies(watchlist, true);
      return;
    }

    if (currentQuery) {
      path = "/search/movie";
      params.query = currentQuery;
      params.include_adult = false;
      updateHeading('Search results for “' + currentQuery + '”', "MOVIE SEARCH");
    } else if (currentGenre || currentSort !== "popularity.desc") {
      path = "/discover/movie";
      params.sort_by = currentSort;
      if (currentGenre) params.with_genres = currentGenre;
      updateHeading(currentGenre ? "Explore by genre" : "Explore movies", "DISCOVER");
    } else {
      path = "/movie/popular";
      updateHeading("Popular right now", "CURATED FOR YOU");
    }

    apiRequest(path, params).done(function (data) {
      if (sequence !== requestSequence) return;
      totalPages = Math.max(1, Math.min(Number(data.total_pages) || 1, 500));
      currentPage = Number(data.page) || 1;
      $("#result-count").text((Number(data.total_results) || 0).toLocaleString() + " movies found");
      renderMovies(data.results || [], false);
      updatePagination();
    }).fail(function (xhr, status) {
      if (sequence !== requestSequence) return;
      let message = "Could not load movies. Check your internet connection and try again.";
      if (status === "timeout") message = "The request took too long. Please try again.";
      if (xhr.status === 401) message = "TMDB rejected the API key. Check that you copied your v3 API key correctly.";
      if (xhr.status === 429) message = "TMDB request limit reached. Wait a moment, then try again.";
      if (xhr.status === 0) message = "The request could not connect. Check your connection and try again.";
      showStatus(message, true);
    });
  }

  function renderMovies(movies, isWatchlist) {
    const $grid = $("#movie-grid").empty();
    if (!movies.length) {
      showStatus(isWatchlist ? "Your watchlist is empty. Select Add to watchlist on a movie to save it here." : "No movies found. Try another title or change the filters.", false);
      $("#result-count").text(isWatchlist ? "0 saved movies" : "0 results");
      $("#pagination").prop("hidden", true);
      return;
    }
    hideStatus();
    movies.forEach(function (movie) {
      const title = safeText(movie.title || movie.name, "Untitled movie");
      const year = getYear(movie.release_date);
      const rating = Number(movie.vote_average);
      const ratingLabel = Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) + "/10" : "Not rated";
      const image = posterUrl(movie.poster_path);
      const saved = hasSaved(movie.id);
      const $card = $("<article>").addClass("movie-card");
      const $posterWrap = $("<div>").addClass("poster-wrap");
      if (image) {
        $("<img>").addClass("poster").attr({ src: image, alt: "Poster for " + title, loading: "lazy" })
          .on("error", function () {
            $(this).replaceWith($("<div>").addClass("poster-placeholder").text("Poster unavailable"));
          }).appendTo($posterWrap);
      } else {
        $("<div>").addClass("poster-placeholder").text("Poster unavailable").appendTo($posterWrap);
      }
      const $body = $("<div>").addClass("card-body");
      $("<h3>").addClass("card-title").text(title).appendTo($body);
      const $meta = $("<div>").addClass("card-meta");
      $("<span>").text(year).appendTo($meta);
      $("<span>").addClass("rating").text("★ " + ratingLabel).appendTo($meta);
      $meta.appendTo($body);
      const $actions = $("<div>").addClass("card-actions");
      $("<button>").addClass("details-button").attr({ type: "button", "data-action": "details", "data-id": movie.id }).text("View details").appendTo($actions);
      $("<button>").addClass("save-button").attr({
        type: "button", "data-action": "toggle-save", "data-id": movie.id, "aria-pressed": String(saved)
      }).text(saved ? "✓ Saved" : "+ Watchlist").appendTo($actions);
      $actions.appendTo($body);
      $card.append($posterWrap, $body).appendTo($grid);
    });
  }

  function updatePagination() {
    const isWatchlist = currentView === "watchlist";
    $("#pagination").prop("hidden", isWatchlist || totalPages <= 1);
    $("#page-label").text("Page " + currentPage + " of " + totalPages);
    $("#previous-page").prop("disabled", currentPage <= 1);
    $("#next-page").prop("disabled", currentPage >= totalPages);
  }

  function setView(view) {
    currentView = view;
    $(".nav-button").removeClass("active").filter('[data-view="' + view + '"]').addClass("active");
    const isWatchlist = view === "watchlist";
    $(".hero").toggle(!isWatchlist);
    $(".filters").toggle(!isWatchlist);
    $("#result-count").toggle(!isWatchlist);
    currentPage = 1;
    if (isWatchlist) {
      updateHeading("My watchlist", "YOUR SAVED COLLECTION");
      $("#result-count").text(watchlist.length + " saved movies");
      setLoading("Loading your watchlist…");
      renderMovies(watchlist, true);
    } else {
      currentQuery = $("#search-input").val().trim();
      loadMovies();
    }
  }

  function toggleWatchlist(movie) {
    const id = Number(movie.id);
    if (hasSaved(id)) {
      watchlist = watchlist.filter(function (item) { return Number(item.id) !== id; });
    } else {
      watchlist.push({
        id: id,
        title: movie.title || movie.name || "Untitled movie",
        release_date: movie.release_date || "",
        poster_path: movie.poster_path || "",
        vote_average: movie.vote_average || 0,
        overview: movie.overview || ""
      });
    }
    saveWatchlist();
    if (currentView === "watchlist") {
      $("#result-count").text(watchlist.length + " saved movies");
      renderMovies(watchlist, true);
    } else {
      // Update the pressed state and label without reloading the page.
      const saved = hasSaved(id);
      $('.save-button[data-id="' + id + '"]').attr("aria-pressed", String(saved)).text(saved ? "✓ Saved" : "+ Watchlist");
    }
  }

  function openMovieDetails(movieId, triggerElement) {
    lastFocusedElement = triggerElement || document.activeElement;
    $("#dialog-content").empty().append($("<p>").text("Loading movie details…"));
    $("#movie-dialog").prop("hidden", false);
    $("#close-dialog").trigger("focus");

    apiRequest("/movie/" + encodeURIComponent(movieId), { append_to_response: "credits" })
      .done(function (movie) {
        const title = safeText(movie.title, "Untitled movie");
        const image = posterUrl(movie.poster_path);
        const genresText = (movie.genres || []).map(function (genre) { return genre.name; }).join(", ");
        const cast = movie.credits && movie.credits.cast ? movie.credits.cast.slice(0, 5).map(function (person) { return person.name; }).join(", ") : "";
        const $layout = $("<div>").addClass("detail-layout");
        if (image) {
          $("<img>").addClass("detail-poster").attr({ src: image, alt: "Poster for " + title })
            .on("error", function () { $(this).replaceWith($("<p>").text("Poster unavailable")); }).appendTo($layout);
        } else {
          $("<div>").addClass("poster-placeholder").text("Poster unavailable").appendTo($layout);
        }
        const $copy = $("<div>").addClass("detail-copy");
        $("<p>").addClass("eyebrow").text("MOVIE DETAILS").appendTo($copy);
        $("<h2>").attr("id", "dialog-title").text(title).appendTo($copy);
        const facts = [getYear(movie.release_date), movie.runtime ? movie.runtime + " min" : "", movie.vote_average ? "★ " + Number(movie.vote_average).toFixed(1) + "/10" : ""].filter(Boolean).join(" • ");
        $("<p>").addClass("detail-facts").text(facts).appendTo($copy);
        $("<p>").text(genresText || "Genres not available").appendTo($copy);
        $("<h3>").text("Overview").appendTo($copy);
        $("<p>").addClass("detail-overview").text(safeText(movie.overview, "No overview is available for this title.")).appendTo($copy);
        $("<h3>").text("Cast").appendTo($copy);
        $("<p>").addClass("detail-overview").text(cast || "Cast information is not available.").appendTo($copy);
        $("<button>").addClass("primary-button").attr({ type: "button", "data-action": "toggle-save", "data-id": movie.id, "aria-pressed": String(hasSaved(movie.id)) })
          .text(hasSaved(movie.id) ? "✓ Saved to watchlist" : "+ Add to watchlist").appendTo($copy);
        $layout.append($copy);
        $("#dialog-content").empty().append($layout);
      })
      .fail(function () {
        $("#dialog-content").empty().append($("<p>").text("Movie details could not be loaded. Please close this dialog and try again."));
      });
  }

  function closeDialog() {
    $("#movie-dialog").prop("hidden", true);
    $("#dialog-content").empty();
    if (lastFocusedElement && document.contains(lastFocusedElement)) lastFocusedElement.focus();
  }

  function loadSuggestions(query) {
    if (!query || query.length < 2 || !apiKey || apiKey === PLACEHOLDER_KEY) {
      $("#suggestions").prop("hidden", true).empty();
      return;
    }
    apiRequest("/search/movie", { query: query, page: 1, include_adult: false })
      .done(function (data) {
        if ($("#search-input").val().trim() !== query) return;
        const $suggestions = $("#suggestions").empty();
        (data.results || []).slice(0, 5).forEach(function (movie) {
          $("<button>").addClass("suggestion-option").attr({ type: "button", role: "option", "data-id": movie.id, "data-title": movie.title })
            .text(movie.title + (movie.release_date ? " (" + getYear(movie.release_date) + ")" : ""))
            .appendTo($suggestions);
        });
        $suggestions.prop("hidden", !$suggestions.children().length);
      });
  }

  function initialize() {
    $("#current-year").text(new Date().getFullYear());
    updateWatchlistCount();

    if (apiKey === PLACEHOLDER_KEY) {
      // Do not make requests with a fake key; the page still explains the setup step.
      updateHeading("Popular right now", "CURATED FOR YOU");
      setLoading("Add your TMDB API key in app.js to load live movie data.");
      $("#status-message").append($("<p>").text("Replace PASTE_YOUR_TMDB_V3_API_KEY_HERE with your TMDB v3 API key, then refresh."));
      return;
    }

    loadGenres().always(function () { loadMovies(); });

    $("#search-form").on("submit", function (event) {
      event.preventDefault();
      currentQuery = $("#search-input").val().trim();
      currentPage = 1;
      currentView = "home";
      $(".nav-button").removeClass("active").filter('[data-view="home"]').addClass("active");
      $("#suggestions").prop("hidden", true);
      loadMovies();
    });

    $("#search-input").on("input", function () {
      const query = $(this).val().trim();
      clearTimeout(suggestionTimer);
      suggestionTimer = setTimeout(function () { loadSuggestions(query); }, 300);
    });

    $("#suggestions").on("click", ".suggestion-option", function () {
      $("#search-input").val($(this).data("title"));
      $("#search-form").trigger("submit");
    });

    $(document).on("click", function (event) {
      if (!$(event.target).closest(".search-form").length) $("#suggestions").prop("hidden", true);
    });

    $(".nav-button").on("click", function () { setView($(this).data("view")); });
    $("#genre-filter").on("change", function () {
      currentGenre = $(this).val();
      currentQuery = "";
      $("#search-input").val("");
      currentPage = 1;
      loadMovies();
    });
    $("#sort-filter").on("change", function () {
      currentSort = $(this).val();
      currentQuery = "";
      $("#search-input").val("");
      currentPage = 1;
      loadMovies();
    });
    $("#clear-filters").on("click", function () {
      currentGenre = "";
      currentSort = "popularity.desc";
      currentQuery = "";
      currentPage = 1;
      $("#genre-filter").val("");
      $("#sort-filter").val("popularity.desc");
      $("#search-input").val("");
      loadMovies();
    });
    $("#previous-page").on("click", function () { if (currentPage > 1) { currentPage--; loadMovies(); } });
    $("#next-page").on("click", function () { if (currentPage < totalPages) { currentPage++; loadMovies(); } });

    $("#movie-grid").on("click", "button[data-action]", function () {
      const action = $(this).data("action");
      const id = Number($(this).data("id"));
      if (action === "details") openMovieDetails(id, this);
      if (action === "toggle-save") {
        const movie = watchlist.find(function (item) { return Number(item.id) === id; });
        if (movie) {
          toggleWatchlist(movie);
          if (!hasSaved(id)) $(this).attr("aria-pressed", "false").text("+ Watchlist");
        } else {
          // The card's basic movie data is stored as data attributes on its matching API result cache below.
          const cached = movieCache[id];
          if (cached) toggleWatchlist(cached);
        }
      }
    });

    $("#dialog-content").on("click", 'button[data-action="toggle-save"]', function () {
      const id = Number($(this).data("id"));
      const cached = movieCache[id] || watchlist.find(function (item) { return Number(item.id) === id; });
      if (cached) {
        toggleWatchlist(cached);
        const saved = hasSaved(id);
        $(this).attr("aria-pressed", String(saved)).text(saved ? "✓ Saved to watchlist" : "+ Add to watchlist");
      }
    });

    $("#close-dialog").on("click", closeDialog);
    $("#movie-dialog").on("click", function (event) { if (event.target === this) closeDialog(); });
    $(document).on("keydown", function (event) {
      if (event.key === "Escape" && !$("#movie-dialog").prop("hidden")) closeDialog();
    });
  }

  // Cache movie records so the watchlist can save the full summary from the current results.
  const movieCache = {};
  const originalRenderMovies = renderMovies;
  renderMovies = function (movies, isWatchlist) {
    (movies || []).forEach(function (movie) { movieCache[movie.id] = movie; });
    originalRenderMovies(movies, isWatchlist);
  };

  $(initialize);
})(jQuery);
