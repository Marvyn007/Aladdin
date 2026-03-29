'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { getClerkErrorMessage } from '@/lib/clerk-error'

// ---------------------------------------------------------------------------
// Typewriter
// ---------------------------------------------------------------------------
function Typewriter({
    text,
    speed = 60,
    cursor = '|',
    loop = true,
    deleteSpeed = 35,
    delay = 2200,
}: {
    text: string | string[]
    speed?: number
    cursor?: string
    loop?: boolean
    deleteSpeed?: number
    delay?: number
}) {
    const [displayText, setDisplayText] = useState('')
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isDeleting, setIsDeleting] = useState(false)
    const [textArrayIndex, setTextArrayIndex] = useState(0)

    const textArray = Array.isArray(text) ? text : [text]
    const currentText = textArray[textArrayIndex] || ''

    useEffect(() => {
        if (!currentText) return
        const timeout = setTimeout(
            () => {
                if (!isDeleting) {
                    if (currentIndex < currentText.length) {
                        setDisplayText((prev) => prev + currentText[currentIndex])
                        setCurrentIndex((prev) => prev + 1)
                    } else if (loop) {
                        setTimeout(() => setIsDeleting(true), delay)
                    }
                } else {
                    if (displayText.length > 0) {
                        setDisplayText((prev) => prev.slice(0, -1))
                    } else {
                        setIsDeleting(false)
                        setCurrentIndex(0)
                        setTextArrayIndex((prev) => (prev + 1) % textArray.length)
                    }
                }
            },
            isDeleting ? deleteSpeed : speed,
        )
        return () => clearTimeout(timeout)
    }, [currentIndex, isDeleting, currentText, loop, speed, deleteSpeed, delay, displayText, textArray.length])

    return (
        <span>
            {displayText}
            <span className="animate-pulse">{cursor}</span>
        </span>
    )
}

// ---------------------------------------------------------------------------
// Sign-in page
// ---------------------------------------------------------------------------
const SIGN_IN_QUOTES = [
    'Your next opportunity is one login away.',
    'Smart job searching starts here.',
    'Land the role you deserve - faster.',
]

export default function SignInPage() {
    const { isLoaded, signIn, setActive } = useSignIn()
    const router = useRouter()

    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [showPassword, setShowPassword] = React.useState(false)
    const [error, setError] = React.useState('')
    const [isLoading, setIsLoading] = React.useState(false)

    const signInWith = (strategy: 'oauth_google' | 'oauth_github') => {
        if (!isLoaded) return
        return signIn.authenticateWithRedirect({
            strategy,
            redirectUrl: '/sso-callback',
            redirectUrlComplete: '/sso-callback',
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isLoaded) return
        setIsLoading(true)
        setError('')
        try {
            const result = await signIn.create({ identifier: email, password })
            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId })
                router.replace('/')
            } else {
                console.log('SignIn status:', result.status)
            }
        } catch (err: unknown) {
            setError(getClerkErrorMessage(err, 'Something went wrong'))
        } finally {
            setIsLoading(false)
        }
    }

    if (!isLoaded) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center bg-white">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="w-full min-h-screen md:grid md:grid-cols-2 lg:grid-cols-[1fr_1.1fr]">
            <style>{`
                input[type="password"]::-ms-reveal,
                input[type="password"]::-ms-clear { display: none; }
            `}</style>

            {/* ── Left — form ────────────────────────────────────────────── */}
            <div className="flex min-h-screen items-center justify-center bg-white px-6 py-10 sm:px-10 md:min-h-0 md:px-8 md:py-12 lg:px-12">
                <div className="mx-auto w-full max-w-[360px] sm:max-w-[400px] md:max-w-[360px] lg:max-w-[400px] flex flex-col gap-6 sm:gap-8">

                    {/* Logo + heading */}
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Link href="/" className="transition-transform hover:scale-105">
                            <Image
                                src="/aladdin-logo.png"
                                alt="Aladdin"
                                width={64}
                                height={64}
                                quality={100}
                                priority
                            />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Sign in to Aladdin</h1>
                            <p className="mt-1 text-sm text-gray-500">Enter your email below to continue</p>
                        </div>
                    </div>

                    {/* OAuth */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => signInWith('oauth_google')}
                            className="flex h-11 w-full items-center justify-center gap-3 rounded-[15px] border border-gray-200 bg-white text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            <div className="relative h-5 w-5">
                                <Image src="/google-icon.png" alt="Google" fill className="object-contain" />
                            </div>
                            Continue with Google
                        </button>
                        <button
                            onClick={() => signInWith('oauth_github')}
                            className="flex h-11 w-full items-center justify-center gap-3 rounded-[15px] bg-[#24292e] text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        >
                            <div className="relative h-5 w-5 invert">
                                <Image src="/github-icon.png" alt="GitHub" fill className="object-contain" />
                            </div>
                            Continue with GitHub
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="relative flex items-center">
                        <div className="flex-1 border-t border-gray-200" />
                        <span className="px-3 text-xs uppercase text-gray-400">or</span>
                        <div className="flex-1 border-t border-gray-200" />
                    </div>

                    {/* Email / password form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="on">
                        {error && (
                            <div className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-500">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    autoComplete="email"
                                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50/60 px-4 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:bg-blue-50/40 focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Password"
                                        required
                                        autoComplete="current-password"
                                        className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50/60 px-4 pr-10 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:bg-blue-50/40 focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((p) => !p)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute inset-y-0 right-0 flex h-full w-10 items-center justify-center text-gray-400 transition-colors hover:text-gray-600"
                                    >
                                        {showPassword
                                            ? <EyeOff className="h-4 w-4" />
                                            : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="mt-1 h-11 w-full rounded-[15px] bg-gray-900 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                        >
                            {isLoading ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>

                    {/* Toggle to sign-up */}
                    <p className="text-center text-sm text-gray-500">
                        Don&apos;t have an account?{' '}
                        <Link href="/sign-up" className="font-semibold text-gray-900 hover:underline">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>

            {/* ── Right — image + typewriter quote ───────────────────────── */}
            <div className="hidden md:block relative overflow-hidden">
                <Image
                    src="/login page photo.png"
                    alt="Aladdin login background"
                    fill
                    className="object-cover object-center"
                    priority
                    sizes="50vw"
                />

                {/* bottom fade */}
                <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/75 to-transparent" />

                {/* quote — positioned 10% from bottom */}
                <div className="absolute inset-x-0 bottom-[10%] z-10 flex flex-col items-center px-8">
                    <blockquote className="max-w-sm space-y-2 text-center">
                        <p className="text-lg font-medium text-white leading-snug">
                            &ldquo;<Typewriter text={SIGN_IN_QUOTES} speed={55} loop />&rdquo;
                        </p>
                        <cite className="block text-sm font-light text-white/60 not-italic">
                            - Aladdin Team
                        </cite>
                    </blockquote>
                </div>
            </div>
        </div>
    )
}
