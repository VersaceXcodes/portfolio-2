import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';

/**
 * UV_SignUp
 * Registration screen for new PortfolioPro editors.
 * Collects full_name, email, and password, performs client-side validation,
 * initiates user creation via the Zustand store, and redirects to the dashboard on success.
 * All rendering is contained within a single top-level fragment.
 */
const UV_SignUp: React.FC = () => {
  // Local form state
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // Field-level validation errors (cleared on input change)
  type FieldErrors = {
    full_name?: string;
    email?: string;
    password?: string;
  } | null;
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(null);

  // Access global auth state and actions via Zustand selectors (CRITICAL: per docs)
  const isLoading = useAppStore(state => state.ui.is_loading);
  const authError = useAppStore(state => state.authentication_state.error_message);
  const registerUser = useAppStore(state => state.register_user);

  // For navigation after successful signup
  const navigate = useNavigate();

  // Helpers
  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const strengthLabel = (s: number) => {
    if (s <= 1) return 'Weak';
    if (s === 2) return 'Fair';
    if (s === 3) return 'Strong';
    return 'Excellent';
  };
  const calcStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    // normalize to 0-4
    if (score > 4) score = 4;
    return score;
  };
  const strength = calcStrength(password);

  // Simple PasswordStrengthIndicator as an inline subcomponent
  const PasswordStrengthIndicator: React.FC<{ score: number }> = ({ score }) => {
    const label = strengthLabel(score);
    const width = Math.min((score + 1) * 20, 100);
    const barColor = score <= 1 ? 'bg-red-500' : score === 2 ? 'bg-yellow-500' : score === 3 ? 'bg-amber-600' : 'bg-green-600';
    return (
      <div aria-label="password-strength" role="meter" className="w-full">
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div className={`${barColor} h-2 rounded-full`} style={{ width: `${width}%` }} />
        </div>
        <div className="text-xs text-gray-700">{`Password strength: ${label}`}</div>
      </div>
    );
  };

  // Handlers - clear errors on input
  const handleFullName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFullName(e.target.value);
    if (fieldErrors) setFieldErrors(null);
  };
  const handleEmail = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (fieldErrors) setFieldErrors(null);
  };
  const handlePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (fieldErrors) setFieldErrors(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Client-side validations
    const errs: FieldErrors = {};
    if (!fullName.trim()) errs.full_name = 'Full name is required';
    if (!email.trim() || !validateEmail(email)) errs.email = 'Please enter a valid email';
    if (!password || password.length < 8) errs.password = 'Password must be at least 8 characters';
    const hasErrors = Object.keys(errs).length > 0;
    setFieldErrors(hasErrors ? (errs as FieldErrors) : null);
    if (hasErrors) return;

    try {
      // Call store to perform registration
      await registerUser(fullName, email, password);
      // Reset form on success
      setFullName('');
      setEmail('');
      setPassword('');
      // Redirect to dashboard for onboarding
      navigate('/dashboard');
    } catch {
      // Errors are surfaced via auth state (authError) in the UI
      // We do not swallow them silently; the global error banner will show
    }
  };

  // Derived: global error banner text
  const showAuthError = !!authError;

  // Render: a single top-level fragment containing the entire UI
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-10">
          <div className="mb-6 text-center">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Sign Up</h1>
            <p className="mt-2 text-sm text-gray-600">
              Create your PortfolioPro editor account. You’ll be guided through onboarding after signup.
            </p>
          </div>

          {showAuthError && (
            <div role="alert" aria-live="polite" className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md" style={{ outline: 'none' }}>
              {authError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
            <div>
              <label htmlFor="signup_full_name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                id="signup_full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={handleFullName}
                aria-invalid={!!fieldErrors?.full_name}
                aria-describedby={fieldErrors?.full_name ? 'full_name_error' : ''}
                placeholder="Your full name"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
              />
              {fieldErrors?.full_name && (
                <p id="full_name_error" className="mt-1 text-xs text-red-600" role="alert" aria-live="polite">
                  {fieldErrors.full_name}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup_email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="signup_email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={handleEmail}
                aria-invalid={!!fieldErrors?.email}
                aria-describedby={fieldErrors?.email ? 'email_error' : ''}
                placeholder="you@example.com"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
              />
              {fieldErrors?.email && (
                <p id="email_error" className="mt-1 text-xs text-red-600" role="alert" aria-live="polite">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password + Strength */}
            <div>
              <label htmlFor="signup_password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="signup_password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={handlePassword}
                aria-invalid={!!fieldErrors?.password}
                aria-describedby={fieldErrors?.password ? 'password_error' : ''}
                placeholder="Create a strong password"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
              />
              {fieldErrors?.password && (
                <p id="password_error" className="mt-1 text-xs text-red-600" role="alert" aria-live="polite">
                  {fieldErrors.password}
                </p>
              )}
              <div className="mt-2">
                <PasswordStrengthIndicator score={strength} />
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="inline-flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12H4z"></path>
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  'Create account'
                )}
              </button>
            </div>

            {/* Inline Sign In link */}
            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link to="/signin" className="font-medium text-blue-600 hover:text-blue-500">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default UV_SignUp;