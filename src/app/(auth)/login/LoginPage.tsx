'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { ArrowRight, Mail, Lock, User as UserIcon } from 'lucide-react';

export function LoginPage() {
  const router = useRouter();
  const login = useAppStore((s) => s.login);
  const signup = useAppStore((s) => s.signup);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0f', // deep dark background
      padding: '24px',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      
      {/* Luxurious Animated Background Orbs */}
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0],
          y: [0, -50, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '50vw',
          height: '50vw',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0) 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <motion.div
        animate={{ 
          scale: [1, 1.5, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -50, 0],
          y: [0, 50, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '-10%',
          width: '60vw',
          height: '60vw',
          background: 'radial-gradient(circle, rgba(20,184,166,0.1) 0%, rgba(0,0,0,0) 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100, damping: 20 }}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(20, 20, 25, 0.6)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '48px 40px',
          boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.8), rgba(99, 102, 241, 0.8))',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            margin: '0 auto 24px auto',
            boxShadow: '0 12px 24px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <img src="/logo.png?v=3" alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} onError={(e) => e.currentTarget.style.display = 'none'} />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 300, color: '#fff', margin: '0 0 8px 0', letterSpacing: '0.05em' }}>
            LEMISPHERE
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', margin: 0, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {isLogin ? 'Access Your Personal OS' : 'Initialize Your Instance'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ position: 'relative' }}>
                  <UserIcon size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Display Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 48px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      fontSize: '14px',
                      color: '#fff',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.4)' }} />
            <input
              type="text"
              placeholder="Username or Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(0, 0, 0, 0.3)',
                fontSize: '14px',
                color: '#fff',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.4)' }} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(0, 0, 0, 0.3)',
                fontSize: '14px',
                color: '#fff',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--status-error)', fontSize: '13px', textAlign: 'center', background: 'var(--status-error-bg)', padding: '8px', borderRadius: '8px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(99, 102, 241, 0.9))',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '16px',
              opacity: loading ? 0.8 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 8px 16px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
            onMouseDown={(e) => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
              textUnderlineOffset: '4px',
              textDecorationColor: 'rgba(255,255,255,0.3)',
            }}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </motion.div>
      
    </div>
  );
}
