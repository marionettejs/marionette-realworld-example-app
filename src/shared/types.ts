export type Profile = {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
};
export type User = Omit<Profile, "following"> & {
  email: string;
  token: string;
};
export type ArticleSummary = {
  slug: string;
  title: string;
  description: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: Profile;
};
export type Article = ArticleSummary & { body: string };
export type Comment = {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: Profile;
};
export type Draft = {
  title: string;
  description: string;
  body: string;
  tagList: string[];
};
export type Status = { pending: boolean; errors: string[] };
export type FeedQuery = {
  tag?: string;
  author?: string;
  favorited?: string;
  following?: boolean;
  page: number;
};
