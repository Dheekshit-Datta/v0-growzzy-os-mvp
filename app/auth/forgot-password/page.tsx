'use client';

import React from "react"

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      setSuccess(true);
      setEmail('');
    } catch (err: any) {
      console.error('[v0] Forgot password error:', err);
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#37322f] flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl">
            <span className="font-semibold">GROWZZY</span>
            <span className="font-light opacity-60"> OS</span>
          </span>
        </Link>

        <div className="space-y-6">
          <h1 className="text-4xl text-white leading-tight font-serif font-normal">
            Reset your password, <span className="text-[#f97316] italic">regain access instantly</span>
          </h1>
          <p className="text-white/60 text-lg font-normal">
            We'll send you a secure link to reset your password and get back to managing your campaigns.
          </p>
        </div>

        <p className="text-white/40 text-sm">© 2025 GROWZZY. All rights reserved.</p>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <Link
          href="/auth"
          className="absolute top-6 left-6 lg:left-auto lg:right-6 flex items-center gap-2 text-[#37322f]/60 hover:text-[#37322f] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </Link>

        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <h2 className="text-2xl text-[#37322f] mb-2 font-serif">Forgot Password?</h2>
            <p className="text-[#37322f]/60 font-normal">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6 bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">
                Check your email for a password reset link. It may take a few minutes to arrive.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-[#37322f]/70">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#37322f]/40" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-11 bg-white border-[#37322f]/10 text-[#37322f] placeholder:text-[#37322f]/40 rounded-xl focus:border-[#f97316]/30 focus:ring-[#f97316]/10"
                  required
                  disabled={isLoading || success}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || success}
              className="w-full h-12 bg-[#37322f] hover:bg-[#37322f]/90 text-white rounded-xl transition-all shadow-[0px_0px_0px_2.5px_rgba(255,255,255,0.08)_inset]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : success ? (
                'Email Sent!'
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-900 text-[#37322f]/40">
                Remember your password?
              </span>
            </div>
          </div>

          <Link href="/auth">
            <Button
              variant="outline"
              className="w-full bg-transparent"
            >
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
