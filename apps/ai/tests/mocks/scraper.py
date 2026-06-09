class MockScraper:
    def __init__(self):
        self.search_calls = []
        self.scrape_calls = []
        self.autocomplete_calls = []

    async def google_autocomplete(self, query):
        self.autocomplete_calls.append(query)
        return [query, f"{query} market", f"{query} competitors"]

    async def serper_search(self, query, search_type="search"):
        self.search_calls.append({"query": query, "search_type": search_type})
        return [
            {
                "title": f"{query} result",
                "snippet": "Relevant market signal.",
                "link": f"https://example.com/{len(self.search_calls)}",
            }
        ]

    async def scrape_url(self, url):
        self.scrape_calls.append(url)
        if "fail" in url:
            raise RuntimeError("scrape failed")
        return f"Scraped content from {url}"

    async def fetch_rss(self, *_args, **_kwargs):
        return []
