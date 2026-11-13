import type { Match } from "@mnjs/router";
import { feedPage } from "../../app/routes.ts";
import type { FeedQuery } from "../../shared/types";
export const profileRoutes = {
  "": { name: "profile", handler: "showFeed" },
  favorites: { name: "favorites", handler: "showFeed" },
};
export const profileQuery = (match: Match): FeedQuery => ({
  page: feedPage(match.query),
  ...(match.name === "favorites"
    ? { favorited: match.params.username }
    : { author: match.params.username }),
});
