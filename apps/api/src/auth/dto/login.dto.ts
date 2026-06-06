import { IsString, IsPhoneNumber } from 'class-validator'

export class LoginDto {
  @IsPhoneNumber('NG')
  phone!: string

  @IsString()
  password!: string
}
