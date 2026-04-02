import { Transform } from 'class-transformer';
import { IsArray, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Parse a value that might be a JSON array string, comma-separated string,
 * or already an array (from multipart/form-data).
 */
function toEmailArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  const str = value.trim();
  if (!str) return [];

  // Try JSON parse first (e.g., '["a@b.com","c@d.com"]')
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map((v: unknown) => String(v).trim()).filter(Boolean);
    } catch {
      // fall through to comma split
    }
  }

  // Comma-separated (e.g., "a@b.com,c@d.com" or single email)
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

export class SendEmailDto {
  @IsOptional()
  @Transform(({ value }) => toEmailArray(value))
  @IsArray()
  @IsEmail({}, { each: true })
  to?: string[];

  @IsOptional()
  @Transform(({ value }) => (value ? toEmailArray(value) : undefined))
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsOptional()
  @Transform(({ value }) => (value ? toEmailArray(value) : undefined))
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  subject!: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fromName?: string;

  // Attachments: array of { filename, contentBase64, contentType? }
  // For JSON requests. File uploads via multipart are handled in the controller.
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  })
  @IsArray()
  attachments?: { filename: string; contentBase64: string; contentType?: string }[];
}
