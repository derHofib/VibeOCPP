import { IsEmail, IsIn, MinLength } from 'class-validator';
import { Role } from '../../common/roles.enum.js';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @MinLength(12)
  password!: string;

  @IsIn([Role.Admin, Role.Mitarbeiter])
  role!: Role;
}
