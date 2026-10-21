import { isSignUpAccepted, signUpAvailability } from './sign-up-policy';

describe('signUpAvailability', () => {
  const cases = [
    // [ligado, raiz, alguma conta] → situação
    [true, false, false, 'bootstrap'],
    [false, false, false, 'bootstrap'],
    [true, false, true, 'platform-not-ready'],
    [false, false, true, 'platform-not-ready'],
    [true, true, true, 'open'],
    [false, true, true, 'disabled'],
  ] as const;

  it.each(cases)(
    'enabled=%s, hasRoot=%s, hasAnyAccount=%s → %s',
    (publicSignupEnabled, hasRoot, hasAnyAccount, expected) => {
      expect(signUpAvailability({ publicSignupEnabled, hasRoot, hasAnyAccount })).toBe(expected);
    },
  );

  it('accepts only open and bootstrap', () => {
    expect(isSignUpAccepted('open')).toBe(true);
    expect(isSignUpAccepted('bootstrap')).toBe(true);
    expect(isSignUpAccepted('disabled')).toBe(false);
    expect(isSignUpAccepted('platform-not-ready')).toBe(false);
  });
});
