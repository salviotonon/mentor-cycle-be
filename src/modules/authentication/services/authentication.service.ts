import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '../../../modules/prisma';
import { UserRepository } from '../../../modules/repositories';

type AuthProvider = 'google' | 'facebook';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userRepository: UserRepository,
  ) {}

  async authenticateUserFromOAuth(
    provider: AuthProvider,
    user: {
      accountId: string;
      email: string;
      firstName: string;
      lastName: string;
      photoUrl?: string;
    },
  ): Promise<{
    user: User;
    token: string;
    new?: boolean;
  }> {
    const { accountId, email, firstName, lastName, photoUrl } = user;

    const existingUser = await this.userRepository.getByEmail(email);

    if (existingUser) {
      return this.signIn(provider, accountId, existingUser);
    }

    return this.signUp(provider, accountId, {
      email,
      firstName,
      lastName,
      photoUrl,
    });
  }

  private async signUp(
    provider: AuthProvider,
    accountId: string,
    user: {
      email: string;
      firstName: string;
      lastName: string;
      photoUrl?: string;
    },
  ) {
    const { email, firstName, lastName, photoUrl } = user;

    const input: Prisma.UserCreateInput = {
      email,
      firstName,
      lastName,
      //photoUrl,
    };

    if (provider === 'google') {
      input.googleId = accountId;
    } else {
      //input.linkedinId = accountId;
    }

    const newUser = await this.userRepository.create(input);

    const token = this.generateToken(newUser.id, email);

    return { token, user: newUser, new: true };
  }

  private async signIn(provider: AuthProvider, accountId: string, user: User) {
    await this.linkOAuthAccountToUser(provider, accountId, user);

    const token = this.generateToken(user.id, user.email);

    return { user, token };
  }

  private async linkOAuthAccountToUser(
    provider: AuthProvider,
    accountId: string,
    user: User,
  ) {
    if (user.googleId) {
      return;
    }

    const updateInput: Prisma.UserUpdateInput = {};

    if (provider === 'google') {
      updateInput.googleId = accountId;
    } else {
      //updateInput.linkedinId = accountId;
    }

    await this.userRepository.update(updateInput, { email: user.email });
  }

  private generateToken(userId: string, email: string) {
    return this.jwtService.sign(
      {
        id: userId,
        email,
        role: 'USER',
      },
      { subject: userId },
    );
  }
}
