import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  clerkUserId: text("clerkUserId").unique(),
  stremioUserId: text("stremioUserId").unique(),
  email: text("email"),
  notificationEmail: text("notificationEmail"),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  role: text("role").notNull().default("user"),
  accessRequestedAt: integer("accessRequestedAt", { mode: "timestamp_ms" }),
  accessRequestEmailedAt: integer("accessRequestEmailedAt", { mode: "timestamp_ms" }),
  approvedAt: integer("approvedAt", { mode: "timestamp_ms" }),
  notifyEmails: integer("notifyEmails", { mode: "boolean" }).notNull().default(true),
  syncCronEnabled: integer("syncCronEnabled", { mode: "boolean" }).notNull().default(true),
  syncCronMode: text("syncCronMode").notNull().default("sync"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});



export const connections = sqliteTable("connections", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  credentials: text("credentials"),
  cursors: text("cursors", { mode: "json" }).$type<Record<string, unknown>>(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  lastSyncAt: integer("lastSyncAt", { mode: "timestamp_ms" }),
  lastError: text("lastError"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
}, (t) => [
  uniqueIndex("connections_user_provider").on(t.userId, t.provider),
]);

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  imdbId: text("imdbId").unique(),
  tmdbId: text("tmdbId"),
  tvmazeId: integer("tvmazeId"),
  type: text("type").notNull(),
  title: text("title"),
  year: integer("year"),
  posterUrl: text("posterUrl"),
  status: text("status"),
  noNotif: integer("noNotif", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const videoIndex = sqliteTable("videoIndex", {
  id: text("id").primaryKey(),
  mediaId: text("mediaId").notNull().references(() => media.id, { onDelete: "cascade" }),
  videoId: text("videoId").notNull(),
  season: integer("season"),
  episode: integer("episode"),
  title: text("title"),
  releasedAt: integer("releasedAt", { mode: "timestamp_ms" }),
}, (t) => [
  uniqueIndex("video_index_media_video").on(t.mediaId, t.videoId),
]);



export const watchState = sqliteTable("watchState", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  mediaId: text("mediaId").notNull().references(() => media.id, { onDelete: "cascade" }),
  season: integer("season"), 
  episode: integer("episode"), 
  watched: integer("watched", { mode: "boolean" }).notNull().default(false),
  positionMs: integer("positionMs").notNull().default(0),
  durationMs: integer("durationMs").notNull().default(0),
  lastWatchedAt: integer("lastWatchedAt", { mode: "timestamp_ms" }),
  timesWatched: integer("timesWatched").notNull().default(0),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
}, (t) => [
  uniqueIndex("watch_state_user_media_ep").on(t.userId, t.mediaId, t.season, t.episode),
]);



export const pushLog = sqliteTable("pushLog", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  itemKey: text("itemKey").notNull(), 
  fingerprint: text("fingerprint").notNull(),
  pushedAt: integer("pushedAt", { mode: "timestamp_ms" }).notNull(),
}, (t) => [
  uniqueIndex("push_log_user_provider_item").on(t.userId, t.provider, t.itemKey),
]);



export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  mediaId: text("mediaId").notNull().references(() => media.id, { onDelete: "cascade" }),
  season: integer("season"),
  episode: integer("episode"),
  title: text("title"),
  airDate: integer("airDate", { mode: "timestamp_ms" }),
  emailedAt: integer("emailedAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
}, (t) => [
  uniqueIndex("notifications_user_media_ep").on(t.userId, t.mediaId, t.season, t.episode),
]);
