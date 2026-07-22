import React, { useState } from 'react';
import { login, register } from '../api';

export default function AuthPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (isRegister) {
        result = await register(email, password, name);
      } else {
        result = await login(email, password);
      }
      onLogin(result.user, result.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>🍼 Baby Tracker</h2>
        <p className="subtitle">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </p>

        {error && <p className="error-msg">{error}</p>}

        {isRegister && (
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              autoFocus
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus={!isRegister}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            required
            minLength={6}
          />
        </div>

        <button type="submit" className="btn-primary btn-full" disabled={loading}>
          {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Log In'}
        </button>

        <div className="auth-toggle">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
            {isRegister ? 'Log In' : 'Sign Up'}
          </button>
        </div>
      </form>
    </div>
  );
}
