(() => {
  const input = document.querySelector("[data-blog-search-input]");
  const clearButton = document.querySelector("[data-blog-search-clear]");
  const resultsText = document.querySelector("[data-blog-search-results]");
  const resultsList = document.querySelector("[data-blog-search-list]");

  if (!input || !resultsText || !resultsList) {
    return;
  }

  const posts = Array.isArray(window.blogSearchIndex)
    ? window.blogSearchIndex
    : [];

  const normalize = (value) => (value || "").toLowerCase().trim();

  const buildSearchText = (post) => {
    const tags = Array.isArray(post.tags) ? post.tags.join(" ") : "";
    return normalize(
      `${post.title || ""} ${tags} ${post.year || ""} ${post.date || ""}`
    );
  };

  const renderResults = (matches, query) => {
    resultsList.innerHTML = "";

    if (!query) {
      resultsText.textContent = "可按标题、标签或年份搜索。";
      return;
    }

    if (matches.length === 0) {
      resultsText.textContent = "没有找到匹配的文章。";
      return;
    }

    resultsText.textContent = `找到 ${matches.length} 篇文章`;

    matches.slice(0, 10).forEach((post) => {
      const listItem = document.createElement("li");
      listItem.className = "sidebar-search-result";

      const link = document.createElement("a");
      link.href = post.url;
      link.textContent = post.title || post.url;

      const meta = document.createElement("div");
      meta.className = "sidebar-search-meta";
      const tags = Array.isArray(post.tags) ? post.tags.join(" / ") : "";
      meta.textContent = [post.year, tags].filter(Boolean).join(" · ");

      listItem.appendChild(link);
      if (meta.textContent) {
        listItem.appendChild(meta);
      }
      resultsList.appendChild(listItem);
    });
  };

  const handleSearch = () => {
    const query = normalize(input.value);
    const terms = query.split(/\s+/).filter(Boolean);

    if (terms.length === 0) {
      renderResults([], "");
      return;
    }

    const matches = posts.filter((post) => {
      const text = buildSearchText(post);
      return terms.every((term) => text.includes(term));
    });

    renderResults(matches, query);
  };

  input.addEventListener("input", handleSearch);
  clearButton.addEventListener("click", () => {
    input.value = "";
    input.focus();
    renderResults([], "");
  });

  renderResults([], "");
})();
