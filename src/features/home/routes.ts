import type { ActiveMatch, Match } from "@mnjs/router";
import { feedPage } from "../../app/routes.ts";
import type { FeedQuery } from "../../shared/types";
export const homeRoutes = {
  "": {
    name: "home",
    handler: "showFeed",
    meta: {
      requiresUser: (match: ActiveMatch) =>
        match.query.get("feed") === "following",
    },
  },
  "tag/:tag": { name: "tag", handler: "showFeed" },
};
export const homeQuery = (match: Match): FeedQuery => ({
  page: feedPage(match.query),
  ...(match.params.tag
    ? { tag: match.params.tag }
    : { following: match.query.get("feed") === "following" }),
});
