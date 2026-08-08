import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color должен быть в формате #RRGGBB' })
  color!: string;

  // Имя иконки lucide в kebab-case, например shopping-cart
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'icon должен быть kebab-case-именем иконки' })
  @MaxLength(50)
  icon!: string;
}
