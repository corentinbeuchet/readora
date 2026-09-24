package com.readora.application.port.out;

/// Sends an email. Delivery problems are the adapter's to log: a caller must not behave differently when mail fails,
/// or the answer would tell whether an address has an account.
public interface MailPort {

    record Email(String to, String subject, String text) {
    }

    void send(Email email);
}
