package com.readora.domain.identity;

/// What an admin decided about an account (US-16). A suspension lifts itself at its date; a ban lasts until reinstated.
public enum AccountStanding {
    ACTIVE,
    SUSPENDED,
    BANNED
}
