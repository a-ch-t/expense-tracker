import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// PartialType не используем: @nestjs/mapped-types нет в зависимостях.
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color должен быть в формате #RRGGBB' })
  color?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'icon должен быть kebab-case-именем иконки' })
  @MaxLength(50)
  icon?: string;
}
