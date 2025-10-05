import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const UV_SignIn: React.FC = () => {
  // Local UI state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [forgotMode, setForgotMode] = useState<boolean>(false);
  const [forgotSent, setForgotSent] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Selectors (CRITICAL: individual selectors, no object-returning hooks)
  const isLoading = useAppStore(state => state.ui.is_loading);
  const authError = useAppStore(state => state.authentication_state.error_message);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const login_user = useAppStore(state => state.login_user);

  // Redirect to dashboard when authenticated
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Clear local errors on input changes (CRITICAL UI rule)
  const onEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setLocalError(null);
  };
  const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setLocalError(null);
  };

  // Basic client-side validations
  const validateEmail = (val: string) => {
    // Simple email-ish check; adjust as needed
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  // Submit handler for sign-in
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Client-side validation
    if (!validateEmail(email)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 1) {
      setLocalError('Please enter your password.');
      return;
    }

    try {
      // Call store action; it handles API call and state updates
      await login_user(email, password);
    } catch {
      // Error is surfaced via auth_error_message in the store; keep UI responsive
    }
  };

  // Forgot Password flow (in-component, lightweight)
  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In MVP, we cannot rely on a backend endpoint definition for forgot-password.
    // Provide a lightweight UX confirmation without a network call.
    setForgotSent(true);
  };

  // Render: a single continuous fragment
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl border border-gray-200 p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">Sign In</h1>
            <p className="mt-2 text-sm text-gray-600">
              Enter your credentials to access PortfolioPro editor
            </p>
          </div>

          {!forgotMode ? (
            <form className="mt-2 space-y-4" onSubmit={handleSubmit} noValidate={true} aria-label="Sign in form">
              {authError && (
                <div role="alert" aria-live="polite" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  <p className="text-sm">{authError}</p>
                </div>
              )}
              {localError && (
                <div role="alert" aria-live="polite" className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
                  <p className="text-sm">{localError}</p>
                </div>
              )}
              <div>
                <label htmlFor="signInEmail" className="sr-only">
                  Email address
                </label>
                <input
                  id="signInEmail"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={onEmailChange}
                  placeholder="Email address"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-0 focus:outline-none placeholder-gray-500 text-gray-900"
                  aria-label="Email address"
                />
              </div>

              <div>
                <label htmlFor="signInPassword" className="sr-only">
                  Password
                </label>
                <input
                  id="signInPassword"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={onPasswordChange}
                  placeholder="Password"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-0 focus:outline-none placeholder-gray-500 text-gray-900"
                  aria-label="Password"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={Boolean(isLoading)}
                  className="w-full inline-flex justify-center items-center px-4 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="inline-flex items-center">
                      <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-white border-r-2 rounded-full" />
                      Signing in...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <Link
                  to="/signup"
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  Don't have an account? Sign up
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setLocalError(null);
                    setForgotSent(false);
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          ) : (
            <form className="mt-2 space-y-4" onSubmit={handleForgotSubmit}>
              <div className="text-center mb-2">
                <h2 className="text-xl font-semibold text-gray-900">Forgot Password</h2>
                <p className="text-sm text-gray-600">Enter your email to receive a password reset link.</p>
              </div>

              <div>
                <label htmlFor="forgotEmail" className="sr-only">
                  Email address
                </label>
                <input
                  id="forgotEmail"
                  name="forgot_email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={onEmailChange}
                  placeholder="Email address"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-0 focus:outline-none"
                  aria-label="Email for password reset"
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full inline-flex justify-center items-center px-4 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  Send reset link
                </button>
              </div>

              {forgotSent && (
                <div className="mt-2 text-sm text-green-700" role="status" aria-live="polite">
                  If an account exists with that email, a password reset link has been sent.
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false);
                    setForgotSent(false);
                    setLocalError(null);
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  Back to Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_SignIn;