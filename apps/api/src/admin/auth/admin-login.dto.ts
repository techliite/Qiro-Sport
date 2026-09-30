import { IsString, MaxLength, MinLength } from 'class-validator'

export class AdminLoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string
}
