import { searchSerper } from "~/serper";
import { bulkCrawlWebsites } from "~/server/scraper";
import { SystemContext, getNextAction } from "~/system-context";
import { answerQuestion } from "~/answer-question";

// Copy of the search function from deep-search.ts
async function search(ctx: SystemContext, query: string) {
  const results = await searchSerper({ q: query, num: 10 }, undefined);

  const queryResults = results.organic.map((result) => ({
    date: result.date ?? "Unknown date",
    title: result.title,
    url: result.link,
    snippet: result.snippet,
  }));

  ctx.reportQueries([{ query, results: queryResults }]);

  return queryResults;
}

// Copy of the scrape function from deep-search.ts
async function scrapeUrl(ctx: SystemContext, urls: string[]) {
  const results = await bulkCrawlWebsites({ urls });

  if (!results.success) {
    const scrapeResults = results.results.map(({ url, result }) => ({
      url,
      result: result.success ? result.data : result.error,
    }));

    ctx.reportScrapes(scrapeResults);
    return scrapeResults;
  }

  const scrapeResults = results.results.map(({ url, result }) => ({
    url,
    result: result.data,
  }));

  ctx.reportScrapes(scrapeResults);
  return scrapeResults;
}

export async function runAgentLoop(userQuestion: string): Promise<string> {
  // A persistent container for the state of our system
  const ctx = new SystemContext(userQuestion);

  // A loop that continues until we have an answer
  // or we've taken 10 actions
  while (!ctx.shouldStop()) {
    // We choose the next action based on the state of our system
    const nextAction = await getNextAction(ctx);

    // We execute the action and update the state of our system
    if (nextAction.type === "search") {
      if (!nextAction.query) {
        throw new Error("Search action requires a query");
      }
      await search(ctx, nextAction.query);
    } else if (nextAction.type === "scrape") {
      if (!nextAction.urls || nextAction.urls.length === 0) {
        throw new Error("Scrape action requires URLs");
      }
      await scrapeUrl(ctx, nextAction.urls);
    } else if (nextAction.type === "answer") {
      return answerQuestion(ctx);
    }

    // We increment the step counter
    ctx.incrementStep();
  }

  // If we've taken 10 actions and still don't have an answer,
  // we ask the LLM to give its best attempt at an answer
  return answerQuestion(ctx, { isFinal: true });
}
