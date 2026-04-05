import { searchPages } from "../../cosense.js";
import { formatPageOutput, formatPageCompact, formatError } from '../../utils/format.js';

export interface SearchPagesPrioritizedParams {
  query: string;
  projectName?: string | undefined;
  compact?: boolean | undefined;
}

function titleMatchesQuery(title: string, queryWords: string[]): boolean {
  const titleLower = title.toLowerCase();
  return queryWords.some(word => titleLower.includes(word.toLowerCase()));
}

export async function handleSearchPagesPrioritized(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: SearchPagesPrioritizedParams
) {
  try {
    const projectName = params.projectName || defaultProjectName;
    const query = String(params.query);
    const results = await searchPages(projectName, query, cosenseSid);

    if (!results) {
      return formatError('No search results', {
        Operation: 'search_pages_by_title',
        Project: projectName,
        Query: query,
        Status: '404',
        Timestamp: new Date().toISOString(),
      }, params.compact);
    }

    const queryWords = results.query.words;
    const titleMatches = results.pages.filter(p => titleMatchesQuery(p.title, queryWords));
    const others = results.pages.filter(p => !titleMatchesQuery(p.title, queryWords));
    const prioritizedPages = [...titleMatches, ...others];

    let output: string;

    if (params.compact) {
      const header = `${projectName} | "${results.searchQuery}" | ${results.count} results (title matches first)`;
      const lines = prioritizedPages.map((page) =>
        formatPageCompact(page, { showMatches: true })
      );
      output = [header, ...lines].join('\n');
    } else {
      output = [
        `Project: ${projectName}`,
        `Search query: ${results.searchQuery}`,
        `Total results: ${results.count}`,
        `Note: Pages whose titles contain search keywords are listed first. Limited to 100 results. No way to fetch beyond this limit. If expected content is not found, please try refining your search query.`,
        '---'
      ].join('\n') + '\n';

      output += prioritizedPages.map((page, index) =>
        formatPageOutput(page, index, {
          showMatches: true,
          showSnippet: true,
          isSearchResult: true
        }) + '\n---'
      ).join('\n');
    }

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return formatError(
      error instanceof Error ? error.message : 'Unknown error',
      {
        Operation: 'search_pages_by_title',
        Project: params.projectName || defaultProjectName,
        Query: params.query,
        Timestamp: new Date().toISOString(),
      },
      params.compact
    );
  }
}
