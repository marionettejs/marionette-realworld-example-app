export const editorRoutes = {
  "": { name: "editor", handler: "showEditor", meta: { requiresUser: true } },
  ":slug": {
    name: "edit",
    handler: "showEditor",
    meta: { requiresUser: true },
  },
};
