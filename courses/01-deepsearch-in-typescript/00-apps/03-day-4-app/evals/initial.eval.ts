import { evalite } from "evalite";
import { askDeepSearch } from "~/deep-search";
import { Factuality } from "~/factuality-scorer";
import type { Message } from "ai";

evalite("Deep Search Eval", {
  data: async (): Promise<{ input: string; expected: string }[]> => {
    return [
      {
        input: "What is the latest version of TypeScript?",
        expected: "The current TypeScript version is 5.8",
      },
      {
        input: "What are the main features of Next.js 15?",
        expected: `
@next/codemod CLI: Easily upgrade to the latest Next.js and React versions.
Async Request APIs (Breaking): Incremental step towards a simplified rendering and caching model.
Caching Semantics (Breaking): fetch requests, GET Route Handlers, and client navigations are no longer cached by default.
React 19 Support: Support for React 19, React Compiler (Experimental), and hydration error improvements.
Turbopack Dev (Stable): Performance and stability improvements.
Static Indicator: New visual indicator shows static routes during development.
unstable_after API (Experimental): Execute code after a response finishes streaming.
instrumentation.js API (Stable): New API for server lifecycle observability.
Enhanced Forms (next/form): Enhance HTML forms with client-side navigation.
next.config: TypeScript support for next.config.ts.
Self-hosting Improvements: More control over Cache-Control headers.
Server Actions Security: Unguessable endpoints and removal of unused actions.
Bundling External Packages (Stable): New config options for App and Pages Router.
ESLint 9 Support: Added support for ESLint 9.
Development and Build Performance: Improved build times and Faster Fast Refresh.
`,
      },
      {
        input:
          "What is the first-weekend domestic box office for 2025 comic book movies?",
        expected: `
In 2025 there were 3 comic book movies that were released:

- Thunderbolts*. $74,300,608 in 4,330 theaters.
- Superman. $125,021,735 in 4,135 theaters.
- The Fantastic Four: First Steps. $117,644,828 in 4,125 theaters.
`,
      },
      {
        input: "In which movies did Pedro Pascal appear in 2025?",
        expected: `
Pedro Pascal appeared in the following movies in 2025:

- Edgington
- Materialists
- The Fantastic Four: First Steps
`,
      },
      {
        input: "What is the overall review for the latest Dexter season?",
        expected: `
The lastest Dexter season which called Dexter: Resurrection received a rating of 9.2/10 on IMDb and 89% on Rotten Tomatoes.
`,
      },
    ];
  },
  task: async (input) => {
    // Convert string input to Message array format
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: input,
      },
    ];
    return askDeepSearch(messages);
  },
  scorers: [
    {
      name: "Contains Links",
      description: "Checks if the output contains any markdown links.",
      scorer: ({ output }) => {
        // Regex to match markdown links: [text](url)
        const markdownLinkRegex = /\[.*?\]\(.*?\)/;
        const containsLinks = markdownLinkRegex.test(output);

        return containsLinks ? 1 : 0;
      },
    },
    Factuality,
  ],
});
