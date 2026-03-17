import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useStore } from '@/store/useStore';

interface JobsMapMapboxProps {
    onJobClick?: (jobId: string) => void;
    onJobOpen?: (jobId: string) => void;
    onJobSave?: (jobId: string) => void;
}

interface JobFeature {
    type: 'Feature';
    id: number;
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        id: string; // Corrected from jobId
        pointId: string;
        title: string;
        company: string;
        companyLogo?: string | null;
        location: string;
        rawLocationText: string;
        postedAt: string;
        sourceUrl: string;
        status: string;
        saved: boolean;
        locationConfidence: number;
        locationSource: string;
    };
}

interface GeoJsonData {
    type: 'FeatureCollection';
    features: JobFeature[];
}

const CLUSTER_MAX_ZOOM = 14;
const CLUSTER_RADIUS = 40;

export default function JobsMapMapbox({ onJobClick, onJobOpen, onJobSave }: JobsMapMapboxProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const popupRef = useRef<mapboxgl.Popup | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    
    const isMapLoaded = useRef(false);
    const isFetchingRef = useRef(false);
    const lastBoundsRef = useRef<string>('');
    const geoJsonDataRef = useRef<GeoJsonData | null>(null);
    const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentZoomRef = useRef<number>(4);
    const stableJobIdRef = useRef<string | null>(null);
    const stableJobDataRef = useRef<{ feature: JobFeature; coords: [number, number] } | null>(null);
    
    const [debugError, setDebugError] = useState<string | null>(null);
    const sidebarOpen = useStore((state) => state.sidebarOpen);

    const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';
    const JOB_SOURCE_ID = 'jobs-source';

    const createPremiumJobCard = (feature: JobFeature): string => {
        const props = feature.properties;
        const companyInitial = (props.company || 'C').charAt(0).toUpperCase();
        
        // Location accuracy note - only show for non-verified locations
        const confidenceLevel = props.locationConfidence || 0.5;
        let accuracyNote = '';
        if (confidenceLevel >= 0.5 && confidenceLevel < 0.8) {
            accuracyNote = `<div style="margin-top: 10px; padding: 8px 10px; background: #fffbeb; border-radius: 6px; display: flex; align-items: flex-start; gap: 6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" style="flex-shrink: 0; margin-top: 1px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span style="font-size: 11px; color: #92400e; line-height: 1.4;">Location is approximate — based on city/region. Tap to correct.</span></div>`;
        } else if (confidenceLevel < 0.5) {
            accuracyNote = `<div style="margin-top: 10px; padding: 8px 10px; background: #fef2f2; border-radius: 6px; display: flex; align-items: flex-start; gap: 6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" style="flex-shrink: 0; margin-top: 1px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><span style="font-size: 11px; color: #b91c1c; line-height: 1.4;">Location is estimated — shown for reference only. Please report if inaccurate.</span></div>`;
        }
        
        // Representational location note - always show with yellow/orange theme
        const representationalNote = `<div style="margin-top: 10px; padding: 10px 12px; background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border-radius: 8px; border-left: 3px solid #eab308; display: flex; align-items: flex-start; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2" style="flex-shrink: 0; margin-top: 1px;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <div style="font-size: 10.5px; color: #854d0e; line-height: 1.5;">
                <span style="font-weight: 600; color: #713f12;">Pin shows general area only</span><br/>
                Exact location hidden to protect employer privacy.
            </div>
        </div>`;
        
        return `
            <div class="job-card" style="font-family: 'Inter', -apple-system, sans-serif; min-width: 300px; max-width: 340px; animation: slideUp 0.2s ease-out; padding: 16px; background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); margin: 0;">
                <style>
                    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    .mapboxgl-popup-content { padding: 0 !important; background: transparent !important; box-shadow: none !important; }
                    .mapboxgl-popup-tip { display: none !important; }
                </style>
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; padding: 4px; border: 1px solid #f1f5f9;">
                        ${props.companyLogo 
                            ? `<img src="${props.companyLogo}" alt="${props.company}" style="width: 100%; height: 100%; object-fit: contain; background: white;" />`
                            : `<span style="color: #3b82f6; font-weight: 700; font-size: 18px; background: white; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">${companyInitial}</span>`
                        }
                    </div>
                    <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 700; font-size: 15px; color: #1a1a2e; line-height: 1.3; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${props.title}</div>
                        <div style="font-size: 13px; font-weight: 500; color: #64748b; margin-bottom: 6px;">${props.company || 'Unknown Company'}</div>
                        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #94a3b8;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${props.location}</span>
                        </div>
                    </div>
                </div>
                
                ${accuracyNote}
                ${representationalNote}
                
                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; gap: 8px;">
                        <button id="mapbox-popup-open-btn" data-job-id="${props.id}" style="background: #1e293b; border: none; color: white; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 6px;">
                            View Details
                        </button>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button id="mapbox-popup-save-btn" data-job-id="${props.id}" style="background: #f1f5f9; border: none; color: #475569; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                            ${props.saved ? 'Saved' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    const showJobCard = (feature: JobFeature, coordinates: [number, number], isStable: boolean = true) => {
        const mapInstance = map.current;
        if (!mapInstance) return;
        
        if (popupRef.current) popupRef.current.remove();
        
        const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: isStable, // Stable ones close on map click, transient ones don't use this but we handle with mouseleave
            offset: [0, -25],
            maxWidth: '360px'
        })
            .setLngLat(coordinates)
            .setHTML(createPremiumJobCard(feature))
            .addTo(mapInstance);

        popupRef.current = popup;

        const popupEl = popup.getElement();
        
        popupEl?.addEventListener('mouseenter', () => {
            // Keep popup open if hovering over the card itself
            if (!isStable) {
                // We'll effectively make it stay open while hovering the card
            }
        });

        const openBtn = popupEl?.querySelector('#mapbox-popup-open-btn');
        openBtn?.addEventListener('click', (evt) => {
            evt.stopPropagation();
            const jobId = openBtn.getAttribute('data-job-id');
            if (jobId) onJobClick?.(jobId);
        });

        const saveBtn = popupEl?.querySelector('#mapbox-popup-save-btn');
        
        saveBtn?.addEventListener('click', (evt) => {
            evt.stopPropagation();
            const jobId = saveBtn.getAttribute('data-job-id');
            if (jobId) {
                // Call the save API
                onJobSave?.(jobId);
                
                // Update UI to show "Saved" state
                saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Saved`;
                (saveBtn as HTMLElement).style.background = '#ecfdf5';
                (saveBtn as HTMLElement).style.border = '1px solid #10b981';
                (saveBtn as HTMLElement).style.color = '#059669';
                
                // Update stable data if this was the stable one
                if (stableJobDataRef.current && stableJobDataRef.current.feature.properties.id === jobId) {
                    stableJobDataRef.current.feature.properties.saved = true;
                }
            }
        });
    };

    const renderCustomMarkers = useCallback(() => {
        const mapInstance = map.current;
        if (!mapInstance || !isMapLoaded.current) return;
        
        // Clear existing custom markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        
        // Query only the features that are currently rendered in the unclustered layer
        const features = mapInstance.queryRenderedFeatures({ layers: ['unclustered-point'] });
        
        // Group by coordinates - but we'll use base coordinates for stability as requested
        const coordGroups = new Map<string, any[]>();
        
        features.forEach((feature) => {
            const coords = (feature.geometry as any).coordinates as [number, number];
            if (!coords) return;
            
            const key = `${coords[0].toFixed(5)},${coords[1].toFixed(5)}`;
            if (!coordGroups.has(key)) {
                coordGroups.set(key, []);
            }
            coordGroups.get(key)!.push(feature);
        });
        
        coordGroups.forEach((groupFeatures, coordKey) => {
            const [baseLng, baseLat] = coordKey.split(',').map(Number);
            
            groupFeatures.forEach((feature, index) => {
                const el = document.createElement('div');
                el.className = 'job-marker-container';
                
                // Add radial offset for overlapping jobs at the same location
                let offsetX = 0;
                let offsetY = 0;
                if (groupFeatures.length > 1) {
                    const angle = (2 * Math.PI * index) / groupFeatures.length;
                    const radius = 0.0002; // Sparkle/sparse effect
                    offsetX = radius * Math.cos(angle);
                    offsetY = radius * Math.sin(angle);
                }

                const coords: [number, number] = [baseLng + offsetX, baseLat + offsetY];
                
                const props = feature.properties;
                const hasLogo = props.companyLogo;
                
                // Use an inner element for scaling to avoid conflicting with Mapbox's absolute positioning transform
                const inner = document.createElement('div');
                inner.className = 'job-marker-inner';
                inner.style.cssText = 'cursor: pointer; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: auto;';
                
                if (hasLogo) {
                    inner.innerHTML = `<div style="width: 44px; height: 44px; border-radius: 50%; background: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2.5px solid #ffffff;"><img src="${props.companyLogo}" alt="${props.company}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: contain; background: #ffffff;" /></div>`;
                } else {
                    const initial = (props.company || 'C').charAt(0).toUpperCase();
                    inner.innerHTML = `<div style="width: 44px; height: 44px; border-radius: 50%; background: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff;"><div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 15px;">${initial}</div></div>`;
                }
                
                el.appendChild(inner);

                const featureData = {
                    type: 'Feature',
                    properties: props,
                    geometry: {
                        type: 'Point',
                        coordinates: coords
                    }
                } as JobFeature;

                inner.onmouseenter = () => {
                    inner.style.transform = 'scale(1.15)';
                    if (stableJobIdRef.current !== props.id) {
                        showJobCard(featureData, coords, false);
                    }
                };

                inner.onmouseleave = () => {
                    inner.style.transform = 'scale(1)';
                    if (stableJobIdRef.current !== props.id) {
                        if (popupRef.current) popupRef.current.remove();
                        popupRef.current = null;
                        if (stableJobDataRef.current) {
                            showJobCard(stableJobDataRef.current.feature, stableJobDataRef.current.coords, true);
                        }
                    }
                };
                
                inner.onclick = (e) => {
                    e.stopPropagation();
                    stableJobIdRef.current = props.id;
                    stableJobDataRef.current = { feature: featureData, coords };
                    onJobClick?.(props.id);
                    showJobCard(featureData, coords, true);
                };
                
                const marker = new mapboxgl.Marker({ element: el })
                    .setLngLat(coords)
                    .addTo(mapInstance);
                
                markersRef.current.push(marker);
            });
        });
    }, [onJobClick, showJobCard]);

    const fetchJobs = useCallback(async (bounds?: mapboxgl.LngLatBounds | null) => {
        if (isFetchingRef.current) return;

        try {
            let url = '/api/jobs/geo';
            if (bounds) {
                const boundsKey = `${bounds.getSouth()}-${bounds.getNorth()}-${bounds.getWest()}-${bounds.getEast()}`;
                if (boundsKey === lastBoundsRef.current) return;
                lastBoundsRef.current = boundsKey;
                
                const params = new URLSearchParams({
                    minLat: bounds.getSouth().toString(),
                    maxLat: bounds.getNorth().toString(),
                    minLng: bounds.getWest().toString(),
                    maxLng: bounds.getEast().toString(),
                });
                url += `?${params.toString()}`;
            }

            isFetchingRef.current = true;
            const res = await fetch(url);
            
            if (!res.ok) throw new Error('Fetch failed');

            const data = await res.json();
            
            if (data.features && Array.isArray(data.features)) {
                const seen = new Set<string>();
                const validFeatures: JobFeature[] = [];
                
                data.features.forEach((f: JobFeature) => {
                    const jobId = f.properties?.id;
                    const coords = f.geometry?.coordinates;
                    
                    if (!jobId || !coords || coords[0] === 0 || coords[1] === 0) return;
                    if (seen.has(jobId)) return;
                    
                    seen.add(jobId);
                    validFeatures.push(f);
                });
                
                geoJsonDataRef.current = {
                    type: 'FeatureCollection',
                    features: validFeatures.map((f, idx) => ({ ...f, id: idx }))
                };
                
                const mapInstance = map.current;
                if (mapInstance && mapInstance.getSource(JOB_SOURCE_ID)) {
                    const source = mapInstance.getSource(JOB_SOURCE_ID) as mapboxgl.GeoJSONSource;
                    source.setData(geoJsonDataRef.current);
                }
            }
        } catch (e) {
            console.error('Failed to load map jobs', e);
        } finally {
            isFetchingRef.current = false;
        }
    }, []);

    const handleMoveEnd = useCallback(() => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        
        fetchTimeoutRef.current = setTimeout(() => {
            const mapInstance = map.current;
            if (!mapInstance) return;
            
            const zoom = mapInstance.getZoom();
            currentZoomRef.current = zoom;
            
            // Update custom markers based on proximity/clustering
            renderCustomMarkers();
            
            fetchJobs(mapInstance.getBounds());
        }, 400);
    }, [fetchJobs, renderCustomMarkers]);

    useEffect(() => {
        if (map.current) return;

        try {
            const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
            if (!token) throw new Error('Missing Mapbox Token');
            mapboxgl.accessToken = token;

            const mapInstance = new mapboxgl.Map({
                container: mapContainer.current!,
                style: MAP_STYLE,
                center: [-74.006, 40.7128],
                zoom: 4,
                projection: { name: 'mercator' },
                renderWorldCopies: true,
                attributionControl: false
            });

            map.current = mapInstance;

            mapInstance.on('load', () => {
                if (isMapLoaded.current) return;
                isMapLoaded.current = true;

                if (!mapInstance.getSource(JOB_SOURCE_ID)) {
                    mapInstance.addSource(JOB_SOURCE_ID, {
                        type: 'geojson',
                        data: { type: 'FeatureCollection', features: [] },
                        cluster: true,
                        clusterMaxZoom: CLUSTER_MAX_ZOOM,
                        clusterRadius: CLUSTER_RADIUS
                    });
                }

                // Cluster circles
                if (!mapInstance.getLayer('clusters')) {
                    mapInstance.addLayer({
                        id: 'clusters',
                        type: 'circle',
                        source: JOB_SOURCE_ID,
                        filter: ['has', 'point_count'],
                        paint: {
                            'circle-color': '#3b82f6',
                            'circle-radius': ['step', ['get', 'point_count'], 20, 10, 25, 25, 30],
                            'circle-stroke-width': 3,
                            'circle-stroke-color': '#ffffff'
                        }
                    });
                }

                // Cluster count
                if (!mapInstance.getLayer('cluster-count')) {
                    mapInstance.addLayer({
                        id: 'cluster-count',
                        type: 'symbol',
                        source: JOB_SOURCE_ID,
                        filter: ['has', 'point_count'],
                        layout: {
                            'text-field': '{point_count_abbreviated}',
                            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                            'text-size': 12
                        },
                        paint: { 'text-color': '#ffffff' }
                    });
                }

                // Click cluster - zoom in (works for any cluster size including 1)
                mapInstance.on('click', 'clusters', (e) => {
                    const features = mapInstance.queryRenderedFeatures(e.point, { layers: ['clusters'] });
                    if (!features.length) return;
                    
                    const feature = features[0];
                    const clusterId = feature.properties?.cluster_id;
                    
                    if (!clusterId) return;
                    
                    const source = mapInstance.getSource(JOB_SOURCE_ID) as mapboxgl.GeoJSONSource;

                    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                        if (err || zoom === null || zoom === undefined) return;
                        
                        const geometry = feature.geometry as { type: string; coordinates: [number, number] };
                        const coords: [number, number] = [...geometry.coordinates];
                        mapInstance.easeTo({
                            center: coords,
                            zoom: Math.min(zoom + 1, 18),
                            duration: 500
                        });
                    });
                });

                // Cursor
                mapInstance.on('mouseenter', 'clusters', () => { mapInstance.getCanvas().style.cursor = 'pointer'; });
                mapInstance.on('mouseleave', 'clusters', () => { mapInstance.getCanvas().style.cursor = ''; });

                // Unclustered point layer (invisible, used for custom marker logic)
                if (!mapInstance.getLayer('unclustered-point')) {
                    mapInstance.addLayer({
                        id: 'unclustered-point',
                        type: 'circle',
                        source: JOB_SOURCE_ID,
                        filter: ['!', ['has', 'point_count']],
                        paint: {
                            'circle-color': 'transparent',
                            'circle-radius': 22
                        }
                    });
                }

                mapInstance.on('move', renderCustomMarkers);
                mapInstance.on('moveend', handleMoveEnd);

                fetchJobs(mapInstance.getBounds());
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Fatal map error:', error);
            setDebugError(errorMessage);
        }

        return () => {
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
            if (popupRef.current) popupRef.current.remove();
            markersRef.current.forEach(marker => marker.remove());
            if (map.current) {
                map.current.remove();
                map.current = null;
                isMapLoaded.current = false;
            }
        };
    }, []);

    useEffect(() => {
        const mapInstance = map.current;
        if (!mapInstance || !mapInstance.loaded()) return;

        const adapt = () => {
            mapInstance.resize();
            if (sidebarOpen) {
                mapInstance.setMaxBounds([[-180, -85], [180, 85]]);
                (mapInstance as unknown as { setRenderWorldCopies: (val: boolean) => void }).setRenderWorldCopies(false);
            } else {
                mapInstance.setMaxBounds(undefined as unknown as mapboxgl.LngLatBoundsLike);
                (mapInstance as unknown as { setRenderWorldCopies: (val: boolean) => void }).setRenderWorldCopies(true);
            }
        };

        const t = setTimeout(adapt, 50);
        const t2 = setTimeout(adapt, 300);

        return () => {
            clearTimeout(t);
            clearTimeout(t2);
        };
    }, [sidebarOpen]);

    if (debugError) {
        return (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900 text-white p-4">
                <div className="bg-red-900/50 p-4 rounded border border-red-500 max-w-md">
                    <h3 className="font-bold mb-2">Map Error</h3>
                    <p className="text-sm font-mono whitespace-pre-wrap">{debugError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative group">
            <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
            <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-lg border border-gray-100 text-xs">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">3</span> 
                        <span className="text-gray-600">Click to zoom</span>
                    </span>
                </div>
            </div>
        </div>
    );
}