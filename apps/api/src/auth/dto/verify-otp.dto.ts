import { IsString, IsPhoneNumber, Length } from 'class-validator'

export class VerifyOtpDto {
  @IsPhoneNumber('NG')
  phone!: string

  @IsString()
  @Length(6, 6)
  otp!: string
}
