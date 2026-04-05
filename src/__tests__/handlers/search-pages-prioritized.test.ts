import { handleSearchPagesPrioritized } from '@/routes/handlers/search-pages-prioritized.js';
import * as cosense from '@/cosense.js';

// モックの設定
jest.mock('@/cosense.js');
const mockedCosense = cosense as jest.Mocked<typeof cosense>;

describe('handleSearchPagesPrioritized', () => {
  const mockProjectName = 'test-project';
  const mockCosenseSid = 'test-sid';

  const mockSearchResponse = {
    projectName: mockProjectName,
    searchQuery: 'test',
    query: { words: ['test'], excludes: [] },
    limit: 100,
    count: 3,
    existsExactTitleMatch: true,
    backend: 'elasticsearch' as const,
    pages: [
      {
        id: 'page1',
        title: 'Body Match Only',
        image: '',
        words: ['test'],
        lines: ['This page has test in the body'],
        created: 1700000000,
        updated: 1700001000,
        user: {
          id: 'user1',
          name: 'testuser',
          displayName: 'Test User',
          photo: 'photo.jpg',
        },
      },
      {
        id: 'page2',
        title: 'Test Page (title match)',
        image: '',
        words: ['test'],
        lines: ['This page has test in the title'],
        created: 1700002000,
        updated: 1700003000,
        user: {
          id: 'user2',
          name: 'anotheruser',
          displayName: 'Another User',
          photo: 'photo2.jpg',
        },
      },
      {
        id: 'page3',
        title: 'Another Body Match',
        image: '',
        words: ['test'],
        lines: ['More test content'],
        created: 1700004000,
        updated: 1700005000,
        user: {
          id: 'user3',
          name: 'thirduser',
          displayName: 'Third User',
          photo: 'photo3.jpg',
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常ケース', () => {
    test('タイトルマッチのページが先頭に来ること', async () => {
      mockedCosense.searchPages.mockResolvedValue(mockSearchResponse);

      const params = { query: 'test' };
      const result = await handleSearchPagesPrioritized(mockProjectName, mockCosenseSid, params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');

      const text = result.content[0]?.text ?? '';

      // タイトルマッチのページが先頭に来ていることを確認
      const titleMatchPos = text.indexOf('Test Page (title match)');
      const bodyMatch1Pos = text.indexOf('Body Match Only');
      const bodyMatch2Pos = text.indexOf('Another Body Match');
      expect(titleMatchPos).toBeLessThan(bodyMatch1Pos);
      expect(titleMatchPos).toBeLessThan(bodyMatch2Pos);
    });

    test('タイトルマッチなしの場合は元の順序を維持すること', async () => {
      const noTitleMatchResponse = {
        ...mockSearchResponse,
        searchQuery: 'keyword',
        query: { words: ['keyword'], excludes: [] },
        pages: [
          { ...mockSearchResponse.pages[0]!, title: 'Page A', words: ['keyword'] },
          { ...mockSearchResponse.pages[1]!, title: 'Page B', words: ['keyword'] },
        ],
      };
      mockedCosense.searchPages.mockResolvedValue(noTitleMatchResponse);

      const params = { query: 'keyword' };
      const result = await handleSearchPagesPrioritized(mockProjectName, mockCosenseSid, params);

      const text = result.content[0]?.text ?? '';
      const pageAPos = text.indexOf('Page A');
      const pageBPos = text.indexOf('Page B');
      // タイトルマッチなしの場合は元の順序を維持
      expect(pageAPos).toBeLessThan(pageBPos);
    });

    test('コンパクトモードでタイトルマッチ優先メッセージが含まれること', async () => {
      mockedCosense.searchPages.mockResolvedValue(mockSearchResponse);

      const params = { query: 'test', compact: true };
      const result = await handleSearchPagesPrioritized(mockProjectName, mockCosenseSid, params);

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('title matches first');

      // コンパクトモードでもタイトルマッチが先頭
      const titleMatchPos = text.indexOf('Test Page (title match)');
      const bodyMatch1Pos = text.indexOf('Body Match Only');
      expect(titleMatchPos).toBeLessThan(bodyMatch1Pos);
    });

    test('フルモードで優先化の説明が含まれること', async () => {
      mockedCosense.searchPages.mockResolvedValue(mockSearchResponse);

      const params = { query: 'test' };
      const result = await handleSearchPagesPrioritized(mockProjectName, mockCosenseSid, params);

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('titles contain search keywords are listed first');
      expect(text).toContain('Total results: 3');
      expect(text).toContain('Project: test-project');
    });

    test('検索APIが呼ばれること', async () => {
      mockedCosense.searchPages.mockResolvedValue(mockSearchResponse);

      const params = { query: 'test' };
      await handleSearchPagesPrioritized(mockProjectName, mockCosenseSid, params);

      expect(mockedCosense.searchPages).toHaveBeenCalledWith(
        mockProjectName,
        'test',
        mockCosenseSid
      );
    });

    test('大文字小文字を区別しないタイトルマッチ', async () => {
      const caseResponse = {
        ...mockSearchResponse,
        searchQuery: 'TEST',
        query: { words: ['TEST'], excludes: [] },
        pages: [
          { ...mockSearchResponse.pages[0]!, title: 'No match here' },
          { ...mockSearchResponse.pages[1]!, title: 'test lowercase title' },
        ],
      };
      mockedCosense.searchPages.mockResolvedValue(caseResponse);

      const params = { query: 'TEST' };
      const result = await handleSearchPagesPrioritized(mockProjectName, mockCosenseSid, params);

      const text = result.content[0]?.text ?? '';
      const titleMatchPos = text.indexOf('test lowercase title');
      const noMatchPos = text.indexOf('No match here');
      expect(titleMatchPos).toBeLessThan(noMatchPos);
    });
  });

  describe('エラーケース', () => {
    test('検索結果がない場合にエラーレスポンスを返すこと', async () => {
      mockedCosense.searchPages.mockResolvedValue(null);

      const params = { query: 'test' };
      const result = await handleSearchPagesPrioritized(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('No search results');
    });

    test('APIエラーの場合にエラーレスポンスを返すこと', async () => {
      const errorMessage = 'Search failed';
      mockedCosense.searchPages.mockRejectedValue(new Error(errorMessage));

      const params = { query: 'test' };
      const result = await handleSearchPagesPrioritized(mockProjectName, mockCosenseSid, params);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain(errorMessage);
    });
  });
});
