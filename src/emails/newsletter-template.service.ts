import { Injectable } from '@nestjs/common';

interface NewsletterData {
  logoSize?: 'small' | 'medium' | 'large';
  logoVariant?: 'dark' | 'light';
  heroImageUrl?: string;
  heroImageHeight?: string;
  heroImageBorder?: 'none' | 'rounded';
  body: string;
  fontFamily?: string;
  ctaText: string;
  ctaUrl: string;
}

interface MergeUser {
  first_name: string | null;
  last_name: string | null;
  user_email: string;
  phone: string | null;
}

@Injectable()
export class NewsletterTemplateService {
  private readonly LOGO_DARK = 'https://sendcoins.ca/images/logoblack.svg';
  private readonly LOGO_LIGHT = 'https://sendcoins.ca/images/logowhite.svg';
  private readonly BRAND_COLOR = '#0647F7';
  private readonly PLAY_STORE_URL =
    'https://play.google.com/store/apps/details?id=com.sendcoins.app';
  private readonly PLAY_BADGE_URL =
    'https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg';

  renderNewsletter(data: NewsletterData): string {
    const font = data.fontFamily || 'Arial, sans-serif';
    const logoH = { small: '24', medium: '36', large: '48' }[data.logoSize ?? 'medium'];
    const logoUrl = data.logoVariant === 'light' ? this.LOGO_LIGHT : this.LOGO_DARK;
    const headerBg = data.logoVariant === 'light' ? '#1a1a2e' : '#ffffff';
    // Use 20px horizontal padding for mobile-friendly spacing
    const px = '20px';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sendcoins Newsletter</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f7f8;font-family:${font};">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f7f8;font-family:${font};">
    <tr>
      <td align="center" style="padding:24px 8px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;font-family:${font};">

          <!-- Header -->
          <tr>
            <td style="padding:20px ${px} 16px ${px};background-color:${headerBg};">
              <img src="${logoUrl}" alt="Sendcoins" height="${logoH}" style="display:block;height:${logoH}px;width:auto;border:0;" />
            </td>
          </tr>

          ${
            data.heroImageUrl
              ? (() => {
                  const hh = data.heroImageHeight && data.heroImageHeight !== 'auto' ? `height:${data.heroImageHeight};object-fit:cover;` : 'height:auto;';
                  const hbr = data.heroImageBorder === 'rounded' ? 'border-radius:12px;' : '';
                  const hpad = data.heroImageBorder === 'rounded' ? `padding:8px ${px} 0 ${px};` : 'padding:0;';
                  return `<tr>
            <td style="${hpad}">
              <img src="${this.esc(data.heroImageUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;${hh}${hbr}border:0;" />
            </td>
          </tr>`;
                })()
              : ''
          }

          <!-- Spacer -->
          <tr><td style="padding:${data.heroImageUrl ? '12px' : '4px'} 0 0 0;"></td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 ${px} 24px ${px};font-size:15px;line-height:1.7;color:#444444;font-family:${font};">
              ${data.body}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:4px ${px} 32px ${px};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:${this.BRAND_COLOR};border-radius:8px;">
                    <a href="${this.esc(data.ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;font-family:${font};">${this.esc(data.ctaText)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 ${px};">
              <hr style="border:none;border-top:1px solid #eeeeee;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px ${px} 12px ${px};font-size:13px;line-height:1.5;color:#888888;font-family:${font};">
              As always, we're here for you. If you run into any issues or have questions, reply to this email or reach us at
              <a href="mailto:support@sendcoins.ca" style="color:${this.BRAND_COLOR};text-decoration:none;">support@sendcoins.ca</a>.
              Our team is ready to help.
            </td>
          </tr>

          <!-- App download -->
          <tr>
            <td align="center" style="padding:0 ${px} 20px ${px};">
              <a href="${this.PLAY_STORE_URL}" target="_blank" style="display:inline-block;">
                <img src="${this.PLAY_BADGE_URL}" alt="Get it on Google Play" height="40" style="display:block;height:40px;width:auto;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Copyright -->
          <tr>
            <td align="center" style="padding:0 ${px} 20px ${px};font-size:11px;color:#aaaaaa;font-family:${font};">
              &copy; ${new Date().getFullYear()} Sendcoins. All rights reserved.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
  }

  replaceMergeFields(html: string, user: MergeUser): string {
    return html
      .replace(/\{\{first_name\}\}/g, user.first_name || 'there')
      .replace(/\{\{last_name\}\}/g, user.last_name || '')
      .replace(/\{\{email\}\}/g, user.user_email)
      .replace(/\{\{phone\}\}/g, user.phone || '');
  }

  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
