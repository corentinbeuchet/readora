# Module 8: Moderation, Trust & Safety

Readora implements robust community moderation tools, automated profanity/spam detection, rate limiting, and triage queues to maintain a safe, welcoming, and high-quality reading environment.

---

## UC-37: Community Moderation & Report Queue

### Overview
Empowers community members to report abusive comments, unmarked spoilers, broken image assets, duplicate chapter uploads, or copyright violations. Reports flow into a centralized triage queue for staff and moderators.

### Actor
- Reader / Community Moderator / Admin

### Report Categories
- `UNMARKED_SPOILER`: Comment spoils major plot points without `||spoiler||` tags.
- `HARASSMENT_ABUSE`: Toxic language, hate speech, or personal attacks.
- `SPAM_SCAM`: Bot links, Discord promotion spam, or phishing URLs.
- `BROKEN_ASSET`: Corrupted, missing, or out-of-order page images.
- `DUPLICATE_UPLOAD`: Duplicate or low-quality scan uploads.

### Primary Flow
1. Next to any comment, chapter, or review, user clicks **"Report"** (`🚩`).
2. User selects category and adds an optional explanation note.
3. The report is logged via `POST /api/v1/moderation/reports`.
4. In the Moderator Dashboard (`/admin/moderation`):
   - Items are sorted by report count and urgency.
   - Moderators review reported content with one-click actions:
     - **Mask as Spoiler**: Wraps target comment with spoiler tags automatically.
     - **Delete Content**: Soft-deletes the comment/review.
     - **Issue Warning / Ban**: Issues temporary timeout or permanent ban to the offender.
     - **Dismiss Report**: Marks report as false positive.

---

## UC-38: Automated Content Filtering & Anti-Spam Rate Limiting

### Overview
Automated guardrails that prevent spam bot floods, malicious link distribution, and aggressive comment spamming.

### Actor
- System / Automated Security Filter

### Security Mechanisms
1. **Comment Throttling / Rate Limiter**:
   - Max 1 comment per 10 seconds per IP/User.
   - Max 30 comments per hour for accounts younger than 7 days.
2. **Regex Profanity & Link Filter**:
   - Blocks known malicious URL shorteners and scam patterns.
   - Automatically masks severe hate speech or flags it for urgent manual review.
3. **Shadow-Banning**:
   - Accounts detected running automated scraping or repetitive spam are silently shadow-banned. Their comments appear published to themselves but are completely hidden from all other users.
