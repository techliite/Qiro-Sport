import { Transform } from 'class-transformer'
import { IsString, IsPhoneNumber } from 'class-validator'
import { normalizeNgPhone } from '../phone'

export class LoginDto {
  @Transform(({ value }) => normalizeNgPhone(value))
  @IsPhoneNumber('NG')
  phone!: string

  @IsString()
  password!: string
}
