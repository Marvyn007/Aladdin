
'use client';

import { useEffect, useState } from 'react';
import JobsMapLeaflet from './JobsMapLeaflet';
import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AuthModal } from '@/components/modals/AuthModal';

// Dynamically import Mapbox to save bundle size if not used, 
// and avoid SSR issues with mapbox-gl (though react-map-gl handles some)
const JobsMapMapbox = dynamic(() => import('./JobsMapMapbox'), {
    ssr: false,
    loading: () => <div style={{ height: '100%', width: '100%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Map...</div>
});

interface JobsMapProps {
    onJobClick?: (jobId: string) => void;
    onJobOpen?: (jobId: string) => void;
    onJobSave?: (jobId: string) => void; // New prop for Save
    onBack?: () => void;
}

export default function JobsMap(props: JobsMapProps) {
    const [useMapbox, setUseMapbox] = useState(false);
    const { isSignedIn, isLoaded } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Check availability
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (token && token.trim() !== '') {
            setUseMapbox(true);
        }
    }, []);

    // While auth is loading, we can show a loader or just wait. 
    // Usually standard to wait or show skeleton.
    // If not loaded yet, maybe show nothing or Leaflet?
    // Let's rely on isLoaded to avoid flashing the modal if possible, 
    // but if it's slow, Leaflet background is fine.

    // Auth Lock Logic
    // If auth is loaded and user is NOT signed in
    if (isLoaded && !isSignedIn) {
        return (
            <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                {/* Fallback Map (Leaflet) purely for background visuals */}
                <div style={{ width: '100%', height: '100%', filter: 'blur(8px)', transform: 'scale(1.05)' }}>
                    <JobsMapLeaflet {...props} />
                </div>

                {/* Login Overlay */}
                <AuthModal
                    isOpen={true}
                    onClose={() => router.push('/')}
                />
            </div>
        );
    }

    if (useMapbox) {
        return <JobsMapMapbox {...props} />;
    }

    return <JobsMapLeaflet {...props} />;
}
