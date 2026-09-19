/** Named so it doesn't clash with the DOM's `Notification`. */
export interface ReaderNotification {
  id: string;
  type: 'NEW_CHAPTER' | 'COMMENT_REPLY';
  message: string;
  /** In-app path, possibly with a query string (`/read/{id}?comment={id}`). */
  link: string;
  createdAt: string;
  read: boolean;
}
