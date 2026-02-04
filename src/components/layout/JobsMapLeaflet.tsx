
'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import L from 'leaflet';

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
    };
}

interface JobsMapProps {
    onJobClick?: (jobId: string) => void;
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

export default function JobsMapLeaflet({ onJobClick }: JobsMapProps) {
    const [jobs, setJobs] = useState<JobGeo[]>([]);
    const [loading, setLoading] = useState(false);

    // Trigger background geocoding on mount
    useEffect(() => {
        fetch('/api/jobs/geo', { method: 'POST' }).catch(err => console.error("BG Geo Trigger Failed", err));
    }, []);

    const fetchJobs = async (bounds?: L.LatLngBounds) => {
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
            }
        } catch (e) {
            console.error("Failed to load map jobs", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs(); // Initial load
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
                                offset={[0, -20]}
                                opacity={1}
                                className="custom-tooltip"
                            >
                                <div style={{
                                    padding: '8px 4px',
                                    minWidth: '180px',
                                    fontFamily: "'Inter', sans-serif"
                                }}>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{job.properties.title}</h3>
                                    <p style={{ margin: '0', fontSize: '12px', fontWeight: 500, color: '#475569' }}>{job.properties.company}</p>
                                    {job.properties.location && (
                                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>📍 {job.properties.location}</p>
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
