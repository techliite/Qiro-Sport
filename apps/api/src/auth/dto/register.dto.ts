import { IsString, IsPhoneNumber, MinLength, MaxLength, Matches, IsDateString } from 'class-validator'

export class RegisterDto {
  @IsPhoneNumber('NG')
  phone!: string

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
  username!: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsDateString()
  dob!: string // ISO date YYYY-MM-DD
}
