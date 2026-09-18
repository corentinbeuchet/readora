# Module 6: Notifications & Personalized Feeds

Inspired by **comix.to**, Readora delivers real-time notifications and personalized chronological release feeds so readers never miss updates from their bookmarked manga and community discussions.

---

## UC-27: Real-Time Chapter Release Notifications

### Overview
Sends push notifications (Web Push API) and in-app notification bell alerts when a newly published chapter is released for a series in the reader's library or from a followed scanlation group.

### Actor
- Registered Reader

### Notification Channels
1. **In-App Bell Dropdown**: Unread counter badge with interactive list of recent releases.
2. **Web Push Notification**: Desktop/Mobile browser notifications via Service Worker when app is backgrounded.
3. **Email Digest** (Optional): Weekly or daily digest summary of new releases.

### Trigger & Event Lifecycle
1. A chapter transition reaches `PUBLISHED` status.
2. The domain emits `ChapterPublishedEvent(workId, chapterId, chapterNumber, scanlationGroupId)`.
3. The notification dispatcher finds all users with an active `Bookmark` (`status IN (READING, PLAN_TO_READ, RE_READING)`) or following the scanlation group.
4. Notifications are persisted in batch to the `notifications` table and pushed via WebPush SPI.
5. Clicking the notification immediately opens the reader at `/read/:workSlug/:chapterNumber`.

---

## UC-28: Personalized Release Feed Timeline

### Overview
A chronological feed displaying new chapter releases strictly tailored to the user's library and followed groups, avoiding clutter from the hundreds of irrelevant global releases.

### Actor
- Registered Reader

### Primary Flow
1. Reader navigates to `/feed` or `/latest`.
2. Reader selects feed filter:
   - **My Followed Series** (Default): Chapters from series in `Reading` or `Plan to Read`.
   - **My Scanlation Groups**: Chapters translated by groups the user follows.
   - **Global Releases**: All public chapters across the platform.
3. The feed presents items in a card timeline:
   - Work cover, title, chapter number, release timestamp (`"12 minutes ago"`), and group badge.
   - Read/Unread badge indicating whether the reader has already read this chapter.
   - Quick **"Read Now"** button.

---

## UC-29: Social Interaction Notifications

### Overview
Alerts users when fellow readers reply to their comments, upvote their reviews, or mention them with `@username` in discussions.

### Actor
- Registered Reader

### Event Types
- `REPLY_TO_COMMENT`: Someone replied to user's comment.
- `COMMENT_MENTION`: User was tagged via `@username`.
- `REVIEW_UPVOTE`: User's review received 10+ helpful votes.
- `COLLECTION_UPVOTE`: User's curated collection received an upvote.

### Primary Flow
1. User receives a notification: *"@Kenji replied to your comment on Chapter 42: 'Totally agree!'"*.
2. Clicking the alert deep-links directly to the chapter discussion with the target comment highlighted in yellow.
