'use client'

import * as React from 'react'
import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function SignInPage() {
    const { isLoaded, signIn, setActive } = useSignIn()
    const router = useRouter()

    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [error, setError] = React.useState('')
    const [isLoading, setIsLoading] = React.useState(false)

    // Handle OAuth
    const signInWith = (strategy: 'oauth_google' | 'oauth_github') => {
        if (!isLoaded) return

        return signIn.authenticateWithRedirect({
            strategy,
            redirectUrl: '/sso-callback',
            redirectUrlComplete: '/'
        })
    }

    // Handle Email/Password Submissions
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isLoaded) return
        setIsLoading(true)
        setError('')

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            })

            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId })
                router.push('/')
            } else {
                // Handle other statuses (e.g. MFA) if needed, 
                // but for now we focus on basic auth matching the design
                console.log('SignIn status:', result.status)
            }
        } catch (err: any) {
            console.error('Error:', err.errors[0])
            setError(err.errors?.[0]?.message || 'Something went wrong')
        } finally {
            setIsLoading(false)
        }
    }

    // Prevent FOUC / Wait for Clerk
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
        Using w-full on small, w-4/5 (80%) on large screens as requested 
      */}
            <div className="flex w-full flex-col items-center justify-center bg-white p-8 lg:w-4/5">
                {/* Updated scale to 0.7x and reduced roundness as requested */}
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
                            {/* Increased text-2xl -> text-4xl (approx 1.3x visual weight) */}
                            <h1 className="text-4xl font-bold text-gray-900">Welcome to Aladdin</h1>
                            {/* Match H1 size/boldness, keep gray color, add line break */}
                            <p className="mt-2 text-4xl font-bold text-gray-500">
                                Everything you need to find the right job.
                            </p>
                        </div>
                    </div>

                    {/* Social Buttons */}
                    <div className="flex w-full flex-col gap-3">
                        <button
                            onClick={() => signInWith('oauth_google')}
                            /* Increased text-sm -> text-lg. Rounded 15px */
                            className="flex h-12 w-full items-center justify-center gap-3 rounded-[15px] border border-gray-200 bg-white text-lg font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            <div className="relative h-6 w-6">
                                <Image src="/google-icon.png" alt="Google" fill className="object-contain" />
                            </div>
                            Continue with Google
                        </button>
                        <button
                            onClick={() => signInWith('oauth_github')}
                            /* Increased text-sm -> text-lg. Rounded 15px */
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

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">

                        {error && (
                            <div className="rounded-[15px] bg-red-50 p-3 text-center text-base text-red-500">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <input
                                type="text" // using text to allow username or email
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email..."
                                /* Increased text-sm -> text-lg. Added px-8 for inner padding. Rounded 15px */
                                className="h-12 w-full rounded-[15px] border-none bg-blue-50/50 px-8 text-lg outline-none transition-all placeholder:text-gray-500 focus:bg-blue-50 focus:ring-2 focus:ring-blue-100"
                                required
                            />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                /* Increased text-sm -> text-lg. Added px-8 for inner padding. Rounded 15px */
                                className="h-12 w-full rounded-[15px] border-none bg-blue-50/50 px-8 text-lg outline-none transition-all placeholder:text-gray-500 focus:bg-blue-50 focus:ring-2 focus:ring-blue-100"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            /* Increased text-sm -> text-lg. Rounded 15px */
                            className="mt-2 h-12 w-full rounded-[15px] bg-gray-900 text-lg font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                        >
                            {isLoading ? 'Signing in...' : 'Sign-in'}
                        </button>
                    </form>

                    <div className="text-center text-lg text-gray-500">
                        Dont have an Account? <Link href="/sign-up" className="font-semibold text-gray-900 hover:underline">Sign up</Link>
                    </div>

                </div>
            </div>

            {/* 
        Right Side - Gallery Grid (1/5th)
        On large screens: 1/5 width (20%).
        On small screens: Hidden (removed as requested).
        Grid: 2 columns (for 4 rows * 2 cols = 8 images).
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
