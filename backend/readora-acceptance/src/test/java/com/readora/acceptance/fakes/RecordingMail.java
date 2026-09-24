package com.readora.acceptance.fakes;

import com.readora.application.port.out.MailPort;

import java.util.ArrayList;
import java.util.List;

/// Keeps the emails instead of sending them.
public class RecordingMail implements MailPort {

    private final List<Email> sent = new ArrayList<>();

    @Override
    public void send(Email email) {
        sent.add(email);
    }

    public List<Email> sent() {
        return List.copyOf(sent);
    }
}
