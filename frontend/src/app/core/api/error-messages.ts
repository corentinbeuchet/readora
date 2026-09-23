/**
 * Reader-facing text for the API's error codes (backend `domain.common.ErrorCodes`, US-13), in the build's language.
 * `undefined` for codes without a translation (e.g. `VALIDATION_FAILED`): the caller then shows the server's own
 * (English) message, which is more precise than a generic sentence.
 *
 * A function, not a constant map, so each call reads the current translations.
 *
 * @param retryAfterSeconds for `RATE_LIMITED`: how long to wait, when the server said (`Retry-After`)
 */
export function errorMessageForCode(code: string | null, retryAfterSeconds: number | null = null): string | undefined {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return $localize`:@@error.invalidCredentials:Invalid email or password.`;
    case 'SESSION_EXPIRED':
      return $localize`:@@error.sessionExpired:Your session has expired. Please log in again.`;
    case 'UNAUTHENTICATED':
      return $localize`:@@error.unauthenticated:Please log in to continue.`;
    case 'FORBIDDEN':
      return $localize`:@@error.forbidden:You don't have permission to do this.`;
    case 'NOT_FOUND':
      return $localize`:@@error.notFound:We couldn't find what you were looking for.`;
    case 'CONFLICT':
      return $localize`:@@error.conflict:Someone else changed this at the same time. Reload and try again.`;
    case 'RATE_LIMITED':
      // "7 s" needs no plural form: ICU plurals only work in templates, not in `$localize` strings.
      if (retryAfterSeconds !== null && retryAfterSeconds > 0) {
        return $localize`:@@error.rateLimitedSeconds:Please wait ${retryAfterSeconds}:seconds: s and try again.`;
      }
      return $localize`:@@error.rateLimited:Too many attempts. Please wait a moment and try again.`;
    case 'MALFORMED_REQUEST':
      return $localize`:@@error.malformedRequest:The request was not valid. Check the form and try again.`;
    case 'TEAM_NAME_TAKEN':
      return $localize`:@@error.teamNameTaken:A team already has this name. Choose another one.`;
    case 'SERIES_ALREADY_IN_TEAM':
      return $localize`:@@error.seriesAlreadyInTeam:Your team already works on this series.`;
    case 'CHAPTER_ALREADY_EXISTS':
      return $localize`:@@error.chapterAlreadyExists:Your team already has this chapter of the series.`;
    case 'TEAM_NOT_ON_SERIES':
      return $localize`:@@error.teamNotOnSeries:Your team does not work on this series yet. Add the series to your team first.`;
    case 'LAST_LEADER':
      return $localize`:@@error.lastLeader:A team needs at least one leader. Name another leader first.`;
    case 'ALREADY_ON_TEAM':
      return $localize`:@@error.alreadyOnTeam:This reader is already on the team.`;
    case 'NOT_ON_TEAM':
      return $localize`:@@error.notOnTeam:This reader is not on the team. Invite them first.`;
    case 'TEAM_REQUIRED':
      return $localize`:@@error.teamRequired:A new series belongs to a team you lead. Start a team first.`;
    case 'INVITATION_PENDING':
      return $localize`:@@error.invitationPending:This reader already has an invitation to the team. Wait for their answer.`;
    case 'FILE_TOO_LARGE':
      return $localize`:@@error.fileTooLarge:This file is too large.`;
    case 'UNSUPPORTED_FILE_FORMAT':
      return $localize`:@@error.unsupportedFileFormat:This file format is not supported.`;
    case 'EMPTY_FILE':
      return $localize`:@@error.emptyFile:This file is empty.`;
    case 'STORAGE_UNAVAILABLE':
      return $localize`:@@error.storageUnavailable:File storage is unavailable right now. Please try again later.`;
    case 'EMAIL_TAKEN':
      return $localize`:@@error.emailTaken:An account already uses this email.`;
    case 'USERNAME_TAKEN':
      return $localize`:@@error.usernameTaken:This username is already taken.`;
    case 'TASK_ALREADY_CLAIMED':
      return $localize`:@@error.taskAlreadyClaimed:Someone else has already claimed this task.`;
    case 'TASK_CLAIMED_BY_OTHER':
      return $localize`:@@error.taskClaimedByOther:This task is claimed by another member.`;
    case 'TASK_ALREADY_EXISTS':
      return $localize`:@@error.taskAlreadyExists:A task for this chapter already exists.`;
    case 'OWN_CONTENT':
      return $localize`:@@error.ownContent:You can't do this on your own content.`;
    case 'LIST_DUPLICATE_SERIES':
      return $localize`:@@error.listDuplicateSeries:This series is already in the list.`;
    case 'ALREADY_HANDLED':
      return $localize`:@@error.alreadyHandled:This has already been handled.`;
    case 'CHAPTER_NOT_PUBLISHED':
      return $localize`:@@error.chapterNotPublished:This chapter is not published yet.`;
    default:
      return undefined;
  }
}
