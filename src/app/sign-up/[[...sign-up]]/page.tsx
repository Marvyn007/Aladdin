'use client'

import * as React from 'react'
import { useSignUp } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function SignUpPage() {
    const { isLoaded, signUp, setActive } = useSignUp()
    const router = useRouter()

    const [firstName, setFirstName] = React.useState('')
    const [lastName, setLastName] = React.useState('')
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [confirmPassword, setConfirmPassword] = React.useState('')
    const [pendingVerification, setPendingVerification] = React.useState(false)
    const [code, setCode] = React.useState('')
    const [error, setError] = React.useState('')
    const [isLoading, setIsLoading] = React.useState(false)

    // Handle OAuth
    const signUpWith = (strategy: 'oauth_google' | 'oauth_github') => {
        if (!isLoaded) return

        return signUp.authenticateWithRedirect({
            strategy,
            redirectUrl: '/sso-callback',
            redirectUrlComplete: '/'
        })
    }

    // Handle Form Submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isLoaded) return

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        setIsLoading(true)
        setError('')

        try {
            await signUp.create({
                firstName,
                lastName,
                emailAddress: email,
                password,
            })

            // Send the email.
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })

            setPendingVerification(true)
        } catch (err: any) {
            console.error(JSON.stringify(err, null, 2))
            setError(err.errors?.[0]?.message || 'Something went wrong')
        } finally {
            setIsLoading(false)
        }
    }

    // Handle Verification Code
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isLoaded) return
        setIsLoading(true)
        setError('')

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code,
            })

            if (completeSignUp.status !== 'complete') {
                /*  investigate the response, to see what is there */
                console.log(JSON.stringify(completeSignUp, null, 2))
                setError('Verification failed. Please try again.')
            }

            if (completeSignUp.status === 'complete') {
                await setActive({ session: completeSignUp.createdSessionId })
                router.push('/')
            }
        } catch (err: any) {
            console.error(JSON.stringify(err, null, 2))
            setError(err.errors?.[0]?.message || 'Verification failed')
        } finally {
            setIsLoading(false)
        }
    }

    // Loading state
    if (!isLoaded) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center bg-white">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen w-full flex-col lg:flex-row">
            {/* 
        Left Side - Authentication Form 
        w-4/5 (80%) on large screens
        w-full on small
      */}
            <div className="flex w-full flex-col items-center justify-center bg-white p-8 lg:w-4/5">
                {/* Updated scale to 0.7x and reduced roundness as requested */}
                <div className="flex w-full max-w-[400px] flex-col items-center justify-center gap-6 origin-center transform scale-[0.7]">

                    {/* Logo & Header */}
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Link href="/" className="transition-transform hover:scale-105">
                            <Image
                                src="/aladdin-logo.png"
                                alt="Aladdin Logo"
                                width={80}
                                height={80}
                                quality={100}
                                priority
                            />
                        </Link>
                        <div>
                            {/* Increased text sizes (~1.3x) */}
                            <h1 className="text-4xl font-bold text-gray-900">
                                {pendingVerification ? 'Verify your email' : 'Create an Account'}
                            </h1>
                            <p className="mt-2 text-4xl font-bold text-gray-500">
                                {pendingVerification
                                    ? 'We sent a code to your email. Enter it below.'
                                    : 'Everything you need to find the right job.'
                                }
                            </p>
                        </div>
                    </div>

                    {!pendingVerification && (
                        <>
                            {/* Social Buttons */}
                            <div className="flex w-full flex-col gap-3">
                                <button
                                    onClick={() => signUpWith('oauth_google')}
                                    /* Increased text and icon size. Rounded 15px */
                                    className="flex h-12 w-full items-center justify-center gap-3 rounded-[15px] border border-gray-200 bg-white text-lg font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                                >
                                    <div className="relative h-6 w-6">
                                        <Image src="/google-icon.png" alt="Google" fill className="object-contain" />
                                    </div>
                                    Continue with Google
                                </button>
                                <button
                                    onClick={() => signUpWith('oauth_github')}
                                    /* Increased text and icon size. Rounded 15px */
                                    className="flex h-12 w-full items-center justify-center gap-3 rounded-[15px] bg-[#24292e] text-lg font-semibold text-white transition-opacity hover:opacity-90"
                                >
                                    <div className="relative h-6 w-6 invert">
                                        <Image src="/github-icon.png" alt="GitHub" fill className="object-contain" />
                                    </div>
                                    Continue with GitHub
                                </button>
                            </div>

                            <div className="relative flex w-full items-center justify-center">
                                <div className="absolute w-full border-t border-gray-200"></div>
                                <span className="relative bg-white px-2 text-sm text-gray-400 uppercase">Or</span>
                            </div>
                        </>
                    )}

                    {/* Form */}
                    <form onSubmit={pendingVerification ? handleVerify : handleSubmit} className="flex w-full flex-col gap-4">

                        {error && (
                            <div className="rounded-[15px] bg-red-50 p-3 text-center text-base text-red-500">
                                {error}
                            </div>
                        )}

                        {!pendingVerification ? (
                            <div className="flex flex-col gap-3">
                                {/* Row 1: First Name & Last Name */}
                                <div className="flex w-full flex-row gap-3">
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="First Name"
                                        /* Reduced width via flex-1. Rounded 15px */
                                        className="h-12 w-full flex-1 rounded-[15px] border-none bg-blue-50/50 px-8 text-lg outline-none transition-all placeholder:text-gray-500 focus:bg-blue-50 focus:ring-2 focus:ring-blue-100"
                                        required
                                    />
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Last Name"
                                        /* Reduced width via flex-1. Rounded 15px */
                                        className="h-12 w-full flex-1 rounded-[15px] border-none bg-blue-50/50 px-8 text-lg outline-none transition-all placeholder:text-gray-500 focus:bg-blue-50 focus:ring-2 focus:ring-blue-100"
                                        required
                                    />
                                </div>

                                {/* Row 2: Email */}
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your work email..."
                                    className="h-12 w-full rounded-[15px] border-none bg-blue-50/50 px-8 text-lg outline-none transition-all placeholder:text-gray-500 focus:bg-blue-50 focus:ring-2 focus:ring-blue-100"
                                    required
                                />

                                {/* Row 3: Password & Confirm Password */}
                                <div className="flex w-full flex-row gap-3">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Password"
                                        className="h-12 w-full flex-1 rounded-[15px] border-none bg-blue-50/50 px-8 text-lg outline-none transition-all placeholder:text-gray-500 focus:bg-blue-50 focus:ring-2 focus:ring-blue-100"
                                        required
                                    />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm Password"
                                        className="h-12 w-full flex-1 rounded-[15px] border-none bg-blue-50/50 px-8 text-lg outline-none transition-all placeholder:text-gray-500 focus:bg-blue-50 focus:ring-2 focus:ring-blue-100"
                                        required
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="Enter verification code..."
                                    className="h-12 w-full rounded-[15px] border-none bg-blue-50/50 px-8 text-center text-xl tracking-widest outline-none transition-all placeholder:text-gray-500 focus:bg-blue-50 focus:ring-2 focus:ring-blue-100"
                                    required
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="mt-2 h-12 w-full rounded-[15px] bg-gray-900 text-lg font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                        >
                            {isLoading ? 'Processing...' : (pendingVerification ? 'Verify Email' : 'Sign up')}
                        </button>
                    </form>

                    <div className="text-center text-lg text-gray-500">
                        Already have an Account? <Link href="/sign-in" className="font-semibold text-gray-900 hover:underline">Sign in</Link>
                    </div>

                </div>
            </div>

            {/* 
        Right Side - Gallery Grid (1/5th)
        On large screens: 1/5 width (20%).
        On small screens: Hidden.
        Added extra top/right spacing (pt-10 pr-10) and vertically stretched images (+5px).
      */}
            <div className="hidden h-full bg-gray-50 p-4 pt-10 pr-10 lg:block lg:w-[22%]">
                <div className="grid h-full grid-cols-2 content-start gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <div key={num} className="relative w-full rounded-[4px] bg-white shadow-sm" style={{ paddingBottom: 'calc(100% + 5px)' }}>
                            <div className="absolute bottom-[6px] left-[6px] right-[6px] top-[6px] overflow-hidden rounded-[2px] bg-gray-200">
                                <Image
                                    src={`/gallery ${num}.${num === 1 ? 'jpg' : 'png'}`}
                                    alt={`Gallery Image ${num}`}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 10vw"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
