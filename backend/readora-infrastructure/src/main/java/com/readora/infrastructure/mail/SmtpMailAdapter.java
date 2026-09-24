package com.readora.infrastructure.mail;

import com.readora.application.port.out.MailPort;
import com.readora.infrastructure.config.MailProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/// Plain-text email over SMTP (`spring.mail.*`): Mailpit in dev, the Amazon SES SMTP endpoint in production. A failed
/// delivery is logged, never thrown: callers must answer the same whether an email went out or not.
@Component
public class SmtpMailAdapter implements MailPort {

    private static final Logger log = LoggerFactory.getLogger(SmtpMailAdapter.class);

    private final JavaMailSender sender;
    private final MailProperties properties;

    public SmtpMailAdapter(JavaMailSender sender, MailProperties properties) {
        this.sender = sender;
        this.properties = properties;
    }

    @Override
    public void send(Email email) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(properties.from());
        message.setTo(email.to());
        message.setSubject(email.subject());
        message.setText(email.text());
        try {
            sender.send(message);
        } catch (MailException e) {
            // The address stays out of the log; the subject says which email failed.
            log.warn("Could not send the email \"{}\"", email.subject(), e);
        }
    }
}
