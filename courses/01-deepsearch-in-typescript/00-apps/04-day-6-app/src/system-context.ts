import { generateObject } from "ai";
import { z } from "zod";
import { model } from "~/model";

export interface SearchAction {
  type: "search";
  query: string;
}

export interface ScrapeAction {
  type: "scrape";
  urls: string[];
}

export interface AnswerAction {
  type: "answer";
}

export type Action = SearchAction | ScrapeAction | AnswerAction;

export const actionSchema = z.object({
  type: z.enum(["search", "scrape", "answer"]).describe(
    `The type of action to take.
      - 'search': Search the web for more information.
      - 'scrape': Scrape a URL.
      - 'answer': Answer the user's question and complete the loop.`,
  ),
  query: z
    .string()
    .describe("The query to search for. Required if type is 'search'.")
    .optional(),
  urls: z
    .array(z.string())
    .describe("The URLs to scrape. Required if type is 'scrape'.")
    .optional(),
});

type QueryResultSearchResult = {
  date: string;
  title: string;
  url: string;
  snippet: string;
};

type QueryResult = {
  query: string;
  results: QueryResultSearchResult[];
};

type ScrapeResult = {
  url: string;
  result: string;
};

const toQueryResult = (query: QueryResultSearchResult) =>
  [`### ${query.date} - ${query.title}`, query.url, query.snippet].join("\n\n");

export class SystemContext {
  /**
   * The current step in the loop
   */
  private step = 0;

  /**
   * The initial question from the user
   */
  private initialQuestion: string;

  /**
   * The history of all queries searched
   */
  private queryHistory: QueryResult[] = [];

  /**
   * The history of all URLs scraped
   */
  private scrapeHistory: ScrapeResult[] = [];

  constructor(initialQuestion: string) {
    this.initialQuestion = initialQuestion;
  }

  shouldStop() {
    return this.step >= 10;
  }

  incrementStep() {
    this.step++;
  }

  getInitialQuestion(): string {
    return this.initialQuestion;
  }

  reportQueries(queries: QueryResult[]) {
    this.queryHistory.push(...queries);
  }

  reportScrapes(scrapes: ScrapeResult[]) {
    this.scrapeHistory.push(...scrapes);
  }

  getQueryHistory(): string {
    return this.queryHistory
      .map((query) =>
        [
          `## Query: "${query.query}"`,
          ...query.results.map(toQueryResult),
        ].join("\n\n"),
      )
      .join("\n\n");
  }

  getScrapeHistory(): string {
    return this.scrapeHistory
      .map((scrape) =>
        [
          `## Scrape: "${scrape.url}"`,
          `<scrape_result>`,
          scrape.result,
          `</scrape_result>`,
        ].join("\n\n"),
      )
      .join("\n\n");
  }
}

export const getNextAction = async (
  context: SystemContext,
): Promise<Action> => {
  const result = await generateObject({
    model,
    schema: actionSchema,
    prompt: `
You are a helpful AI assistant with access to real-time web search capabilities. The current date and time is ${new Date().toLocaleString()}.

Your job is to choose the next action to take based on the current context. You can:

1. SEARCH: Search the web for more information when you need to find relevant sources
2. SCRAPE: Scrape specific URLs to get detailed content from web pages
3. ANSWER: Answer the user's question when you have enough information

Choose the next action wisely:
- If you need more information, choose SEARCH with a specific query
- If you have URLs but need their content, choose SCRAPE with those URLs
- If you have enough information to answer the user's question, choose ANSWER

Remember to be thorough but efficient. Always search for diverse sources and scrape multiple URLs before answering.

User's question: ${context.getInitialQuestion()}

Here is the current context with all the information we have gathered:

${context.getQueryHistory()}

${context.getScrapeHistory()}
    `,
  });

  // Validate that required fields are present based on action type
  const action = result.object;

  if (action.type === "search" && !action.query) {
    throw new Error("Search action requires a query");
  }

  if (action.type === "scrape" && (!action.urls || action.urls.length === 0)) {
    throw new Error("Scrape action requires URLs");
  }

  return action as Action;
};
