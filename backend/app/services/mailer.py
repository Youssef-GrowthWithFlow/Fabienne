"""Transactional email over SMTP.

Sending is best-effort and never raises at the call site: a dead SMTP host
must not turn ``/forgot-password`` into a 500, because the endpoint answers
204 unconditionally to avoid leaking whether an address is registered.

With an empty ``SMTP_HOST`` the mailer logs the message instead of sending
it, which is what local dev runs on.
"""
from __future__ import annotations

import logging
from email.message import EmailMessage

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(*, to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Send one message. Returns True if SMTP accepted it."""
    if not settings.SMTP_HOST:
        logger.info("SMTP disabled — email to %s not sent:\n%s\n%s", to, subject, text)
        return False

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            use_tls=settings.SMTP_USE_SSL,
            start_tls=not settings.SMTP_USE_SSL,
            timeout=settings.SMTP_TIMEOUT,
        )
    except (aiosmtplib.SMTPException, OSError):
        logger.exception("SMTP send failed for %s", to)
        return False

    logger.info("Email sent to %s (%s)", to, subject)
    return True


async def send_password_reset(*, to: str, reset_url: str) -> bool:
    minutes = settings.PASSWORD_RESET_EXPIRE_MINUTES
    text = (
        "Bonjour,\n\n"
        "Tu as demandé à réinitialiser ton mot de passe Fabienne.\n"
        f"Ouvre ce lien pour choisir un nouveau mot de passe :\n\n{reset_url}\n\n"
        f"Le lien expire dans {minutes} minutes.\n"
        "Si tu n'es pas à l'origine de cette demande, ignore ce message.\n"
    )
    html = f"""\
<html>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #18181b;">
    <p>Bonjour,</p>
    <p>Tu as demandé à réinitialiser ton mot de passe Fabienne.</p>
    <p>
      <a href="{reset_url}"
         style="display: inline-block; padding: 10px 18px; border-radius: 8px;
                background: #18181b; color: #fafafa; text-decoration: none;">
        Choisir un nouveau mot de passe
      </a>
    </p>
    <p style="color: #71717a; font-size: 13px;">
      Le lien expire dans {minutes} minutes. Si tu n'es pas à l'origine de cette
      demande, ignore ce message.
    </p>
  </body>
</html>
"""
    return await send_email(
        to=to,
        subject="Réinitialiser ton mot de passe Fabienne",
        text=text,
        html=html,
    )
