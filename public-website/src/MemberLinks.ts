const app = new URL(
  import.meta.env.VITE_MEMBER_APP_URL || "http://localhost:3000/",
  window.location.origin,
);
export const catalogUrl = new URL("#books", app).href;
export const loginUrl = new URL("?auth=login#bookshelf", app).href;
export const joinUrl = new URL("?auth=register#bookshelf", app).href;
