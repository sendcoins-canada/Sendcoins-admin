import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendNewsletterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  subject!: string;

  @IsOptional()
  @IsIn(['small', 'medium', 'large'])
  logoSize?: 'small' | 'medium' | 'large';

  @IsOptional()
  @IsIn(['dark', 'light'])
  logoVariant?: 'dark' | 'light';

  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @IsOptional()
  @IsString()
  heroImageHeight?: string;

  @IsOptional()
  @IsIn(['none', 'rounded'])
  heroImageBorder?: 'none' | 'rounded';

  @IsOptional()
  @IsString()
  greeting?: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsString()
  @MinLength(1)
  ctaText!: string;

  @IsString()
  @MinLength(1)
  ctaUrl!: string;

  @IsIn(['all', 'unverified', 'inactive', 'verified', 'custom'])
  segment!: 'all' | 'unverified' | 'inactive' | 'verified' | 'custom';

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.map((v: unknown) => String(v).trim()).filter(Boolean);
    if (typeof value === 'string') {
      const str = value.trim();
      if (str.startsWith('[')) {
        try {
          const parsed = JSON.parse(str);
          if (Array.isArray(parsed)) return parsed.map((v: unknown) => String(v).trim()).filter(Boolean);
        } catch { /* fall through */ }
      }
      return str.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
  })
  @IsArray()
  @IsEmail({}, { each: true })
  customEmails?: string[];
}
