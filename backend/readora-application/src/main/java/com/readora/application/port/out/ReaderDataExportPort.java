package com.readora.application.port.out;

import com.readora.application.export.ReaderData;
import com.readora.domain.common.UserId;

/// Reads everything a reader has for the account export (US-15), in a few queries rather than one port per table.
/// A table keyed by a reader belongs here as well as in `ReaderDataErasurePort`.
public interface ReaderDataExportPort {
    ReaderData dataOf(UserId userId);
}
