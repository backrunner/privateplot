export interface Article {
  id: string;
  title: string;
  summary: string;
  createdAt: Date;
  updatedAt?: Date;
  slug: string;
}
