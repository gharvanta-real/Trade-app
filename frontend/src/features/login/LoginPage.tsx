import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { HugeIcon } from '../../components/HugeIcon';
import { ZapIcon, CpuIcon, CompassIcon, BarChartIcon } from '@hugeicons/core-free-icons';
import './login.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: Component<LoginPageProps> = (props) => {
  const [email, setEmail] = createSignal('sunil.kumar@example.com');
  const [password, setPassword] = createSignal('••••••••');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    props.onLoginSuccess();
  };

  return (
    <div class="login-viewport">
      {/* Left Login Form Panel */}
      <div class="login-left">
        <div class="login-form-box">
          <div class="login-header">
            <h1 class="login-title">Welcome Back!</h1>
            <p class="login-subtitle">Login to your account to start trading</p>
          </div>

          <form class="login-form" onSubmit={handleSubmit}>
            <div class="login-field">
              <label class="login-label">Email or Mobile</label>
              <input 
                type="text" 
                class="login-input" 
                value={email()} 
                onInput={(e) => setEmail(e.currentTarget.value)}
                required 
              />
            </div>

            <div class="login-field">
              <label class="login-label">Password</label>
              <input 
                type="password" 
                class="login-input" 
                value={password()} 
                onInput={(e) => setPassword(e.currentTarget.value)}
                required 
              />
            </div>

            <div class="login-options">
              <label class="login-remember">
                <input type="checkbox" checked />
                <span>Remember me</span>
              </label>
              <a href="#" class="login-forgot">Forgot Password?</a>
            </div>

            <button type="submit" class="login-btn">
              LOGIN
            </button>
          </form>

          <p class="login-footer-text">
            Don't have an account? <a href="#">Sign Up</a>
          </p>
        </div>
      </div>

      {/* Right Branding Panel (Dark Slate Obsidian) */}
      <div class="login-right">
        <div class="login-brand-box">
          <div>
            <div class="login-brand-logo">
              NEXUS <span>AI</span>
            </div>
            <p class="login-brand-desc" style={{ "margin-top": "var(--sys-space-2)" }}>
              The next-generation, AI-native desktop trading terminal built for elite traders and quantitative strategies.
            </p>
          </div>

          <div class="login-features-list">
            <div class="login-feature-card">
              <HugeIcon icon={ZapIcon} size={14} class="login-feature-icon" />
              <span class="login-feature-title">Lightning Fast</span>
              <p class="login-feature-desc">Microsecond IPC pipeline with zero runtime allocations.</p>
            </div>
            <div class="login-feature-card">
              <HugeIcon icon={CpuIcon} size={14} class="login-feature-icon" />
              <span class="login-feature-title">AI Driven</span>
              <p class="login-feature-desc">In-process model execution for real-time risk predictions.</p>
            </div>
            <div class="login-feature-card">
              <HugeIcon icon={CompassIcon} size={14} class="login-feature-icon" />
              <span class="login-feature-title">Smart Strategies</span>
              <p class="login-feature-desc">Interactive conditional logic builder with backtests.</p>
            </div>
            <div class="login-feature-card">
              <HugeIcon icon={BarChartIcon} size={14} class="login-feature-icon" />
              <span class="login-feature-title">Advanced Analytics</span>
              <p class="login-feature-desc">Historical statistics, performance ratios, and trade logs.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
