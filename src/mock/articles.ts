interface Article {
  id: string;
  title: string;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
}

// Generate mock articles
const generateMockArticles = (count: number): Article[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: `article-${index + 1}`,
    title: `Article ${index + 1}: The New Function You Need To Learn`,
    summary: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat ${index + 1}.`,
    createdAt: new Date(2024, 0, index + 1),
    updatedAt: new Date(2024, 2, index + 1),
    slug: `article-${index + 1}`
  }));
};

// Mock database
const mockArticles = generateMockArticles(100);

// Function to get paginated articles
export const getPaginatedArticles = async (page: number, pageSize: number = 10) => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const articles = mockArticles.slice(start, end);
  
  return {
    articles,
    hasMore: end < mockArticles.length,
    total: mockArticles.length
  };
};

export type { Article }; 