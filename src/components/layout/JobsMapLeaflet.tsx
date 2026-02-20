
'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import L from 'leaflet';
import {
    getCachedMapPins,
    setCachedMapPins,
    isMapPinsCacheStale,
} from '@/lib/job-cache';

interface JobGeo {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number]; // lng, lat
    };
    properties: {
        id: string;
        title: string;
        company: string;
        location: string;
        postedAt: string;
        sourceUrl: string;
        status?: string;
    };
}

interface JobsMapProps {
    onJobClick?: (jobId: string) => void;
    onJobOpen?: (jobId: string) => void;
    onJobSave?: (jobId: string) => void;
}

function MapEvents({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
    const map = useMapEvents({
        moveend: () => {
            onBoundsChange(map.getBounds());
        },
        zoomend: () => {
            onBoundsChange(map.getBounds());
        }
    });
    return null;
}

const createClusterCustomIcon = function (cluster: any) {
    return L.divIcon({
        html: `<span>${cluster.getChildCount()}</span>`,
        className: 'cluster-marker',
        iconSize: L.point(36, 36, true),
    });
}

const createJobIcon = (title: string) => {
    const letter = title ? title.charAt(0).toUpperCase() : '?';

    // Custom pin HTML with image and centered text
    const html = `
        <div style="position: relative; width: 22px; height: 22px; display: flex; justify-content: center; align-items: center;">
            <img src="/map_pin.png" alt="pin" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0;" />
            <span style="position: relative; z-index: 10; font-family: sans-serif; font-weight: bold; color: white; font-size: 9px; margin-bottom: 4px;">${letter}</span>
        </div>
    `;

    return L.divIcon({
        html: html,
        className: '', // Remove default styles if any interfere, or keep 'job-marker' if valid. Using empty to rely on inline styles for now.
        iconSize: L.point(22, 22, true),
        iconAnchor: [11, 22], // Tip of pin (assuming bottom center)
        popupAnchor: [0, -22]
    });
};

export default function JobsMapLeaflet({ onJobClick, onJobOpen, onJobSave }: JobsMapProps) {
    const [jobs, setJobs] = useState<JobGeo[]>([]);
    const [loading, setLoading] = useState(false);

    // Trigger background geocoding on mount
    useEffect(() => {
        fetch('/api/jobs/geo', { method: 'POST' }).catch(err => console.error("BG Geo Trigger Failed", err));
    }, []);

    const fetchJobs = async (bounds?: L.LatLngBounds) => {
        // Cache-first for initial load (no bounds specified)
        if (!bounds) {
            const cached = getCachedMapPins();
            if (cached) {
                // Show cached pins immediately
                setJobs(cached.features);

                // Refresh in background if stale
                if (isMapPinsCacheStale(cached.meta)) {
                    fetchMapPinsInBackground();
                }
                return;
            }
        }

        setLoading(true);
        try {
            let url = '/api/jobs/geo';
            if (bounds) {
                const params = new URLSearchParams({
                    minLat: bounds.getSouth().toString(),
                    maxLat: bounds.getNorth().toString(),
                    minLng: bounds.getWest().toString(),
                    maxLng: bounds.getEast().toString(),
                });
                url += `?${params.toString()}`;
            }

            const res = await fetch(url);
            const data = await res.json();
            if (data.features) {
                setJobs(data.features);

                // Cache global pins (no bounds filter) for instant load on next visit
                if (!bounds) {
                    setCachedMapPins(data.features);
                }
            }
        } catch (e) {
            console.error("Failed to load map jobs", e);
        } finally {
            setLoading(false);
        }
    };

    // Background fetch for pins (no loading indicator)
    const fetchMapPinsInBackground = async () => {
        try {
            const res = await fetch('/api/jobs/geo');
            const data = await res.json();
            if (data.features) {
                setJobs(data.features);
                setCachedMapPins(data.features);
            }
        } catch (e) {
            console.error("Background map pins refresh failed", e);
        }
    };

    useEffect(() => {
        fetchJobs(); // Initial load (will use cache if available)
    }, []);

    return (
        <div style={{ height: '100%', width: '100%', position: 'relative', zIndex: 0 }}>
            {/* Back Button */}


            {loading && (
                <div style={{
                    position: 'absolute', top: 20, right: 20, zIndex: 1000,
                    background: 'white', padding: '8px 16px', borderRadius: '20px',
                    fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                    Updating map...
                </div>
            )}

            <MapContainer
                center={[20, 0]}
                zoom={2}
                minZoom={2} // Prevent zooming out to see multiple worlds
                style={{ height: '100%', width: '100%', background: '#f5f5f5' }} // Neutral background
                scrollWheelZoom={true}
            >
                {/* CartoDB Positron - Modern, clean, minimal */}
                <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />

                <MapEvents onBoundsChange={(bounds) => fetchJobs(bounds)} />

                <MarkerClusterGroup
                    chunkedLoading
                    iconCreateFunction={createClusterCustomIcon}
                    maxClusterRadius={60} // Tweak density
                    showCoverageOnHover={false}
                >
                    {jobs.map((job) => (
                        <Marker
                            key={job.properties.id}
                            position={[job.geometry.coordinates[1], job.geometry.coordinates[0]]} // Lat, Lng
                            icon={createJobIcon(job.properties.title)}
                            eventHandlers={{
                                click: () => onJobClick?.(job.properties.id),
                            }}
                        >
                            <Tooltip
                                direction="top"
                                offset={[0, -5]} // Slightly overlap to ensure no gap for hover interaction
                                opacity={1}
                                interactive={true} // Allow clicking buttons inside
                                className="custom-tooltip"
                            >
                                <div style={{
                                    padding: '8px 4px',
                                    minWidth: '200px',
                                    fontFamily: "'Inter', sans-serif"
                                }}>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{job.properties.title}</h3>
                                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 500, color: '#475569' }}>{job.properties.company}</p>

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        {job.properties.sourceUrl && (
                                            <a
                                                href={job.properties.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    flex: 1,
                                                    textAlign: 'center',
                                                    background: '#fff',
                                                    border: '1px solid #e2e8f0',
                                                    color: '#334155',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    textDecoration: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                View Original
                                            </a>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onJobSave?.(job.properties.id);

                                                // Optimistic update
                                                setJobs(currentStatus =>
                                                    currentStatus.map(j =>
                                                        j.properties.id === job.properties.id
                                                            ? { ...j, properties: { ...j.properties, status: j.properties.status === 'saved' ? 'fresh' : 'saved' } }
                                                            : j
                                                    )
                                                );
                                            }}
                                            title={job.properties.status === 'saved' ? 'Saved' : 'Save Job'}
                                            style={{
                                                background: job.properties.status === 'saved' ? '#ecfdf5' : '#f1f5f9',
                                                border: job.properties.status === 'saved' ? '1px solid #10b981' : 'none',
                                                color: job.properties.status === 'saved' ? '#059669' : '#64748b',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '32px'
                                            }}
                                        >
                                            {job.properties.status === 'saved' ? (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                                            )}
                                        </button>
                                    </div>

                                    {job.properties.location && (
                                        <p style={{ margin: '8px 0 0 0', fontSize: '10px', color: '#64748b', textAlign: 'right' }}>📍 {job.properties.location}</p>
                                    )}
                                </div>
                            </Tooltip>
                        </Marker>
                    ))}
                </MarkerClusterGroup>
            </MapContainer>
        </div>
    );
}
