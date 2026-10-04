import { Transform } from 'class-transformer'
import { IsString, IsPhoneNumber, Length } from 'class-validator'
import { normalizeNgPhone } from '../phone'

export class VerifyOtpDto {
  @Transform(({ value }) => normalizeNgPhone(value))
  @IsPhoneNumber('NG')
  phone!: string

  @IsString()
  @Length(6, 6)
  otp!: string
}
