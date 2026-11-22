import { BRAND } from "@lovora/domain";

export type RenderedMail = { subject: string; text: string; html: string };

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * A single-purpose recovery email: no links, no tracking pixels, and the code
 * only. Recipients who did not ask for it can ignore it safely.
 */
export function recoveryCodeEmail(code: string, minutes: number): RenderedMail {
  const subject = `${code} is your ${BRAND.name} code`;
  const text = [
    `Your ${BRAND.name} verification code`,
    "",
    code,
    "",
    `It expires in ${minutes} minutes and works once.`,
    "If you didn't ask to reset your password, ignore this email — your password has not changed.",
    "",
    BRAND.name,
    BRAND.tagline,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0b0b10;color:#f4f1ea;font-family:${FONT};">
    <div style="display:none;max-height:0;overflow:hidden;">Your ${BRAND.name} code expires in ${minutes} minutes.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b10;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#14141c;border:1px solid #2a2a38;border-radius:20px;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <p style="margin:0;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#b9a6ff;">${BRAND.name}</p>
                <h1 style="margin:14px 0 0;font-size:22px;line-height:1.3;font-weight:600;color:#f4f1ea;">Your verification code</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#a9a7b8;">Enter this code to reset your password. It expires in ${minutes} minutes and works once.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;">
                <div style="padding:18px 12px;background:#0b0b10;border:1px solid #2a2a38;border-radius:14px;text-align:center;font-size:34px;letter-spacing:10px;font-weight:700;color:#f4f1ea;font-family:'SFMono-Regular',Consolas,monospace;">${code}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8c8999;">If you didn't ask to reset your password, ignore this email — your password has not changed.</p>
                <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#8c8999;">${BRAND.tagline}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
