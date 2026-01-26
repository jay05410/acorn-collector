import type { UserRepository } from '../repositories/user-repository';
import type { CreditRepository } from '../repositories/credit-repository';
import type { User } from '../entities/user';

export interface GoogleAuthProvider {
  verifyToken(idToken: string): Promise<GoogleUserInfo>;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface AuthResult {
  user: User;
  isNewUser: boolean;
}

export class AuthenticateUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private creditRepository: CreditRepository,
    private googleAuth: GoogleAuthProvider
  ) {}

  async execute(googleIdToken: string): Promise<AuthResult> {
    const googleUser = await this.googleAuth.verifyToken(googleIdToken);

    let user = await this.userRepository.findByGoogleId(googleUser.sub);
    const isNewUser = !user;

    if (!user) {
      user = await this.userRepository.create({
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
      });
      await this.creditRepository.initializeBalance(user.id);
    }

    return { user, isNewUser };
  }
}
