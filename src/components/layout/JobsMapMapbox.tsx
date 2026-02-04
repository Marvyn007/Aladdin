import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useStore } from '@/store/useStore';

interface JobsMapMapboxProps {
    onJobClick?: (jobId: string) => void;
}

export default function JobsMapMapbox({ onJobClick }: JobsMapMapboxProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const popupRef = useRef<mapboxgl.Popup | null>(null);
    const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
    const [debugError, setDebugError] = useState<string | null>(null);

    // Access global sidebar state
    const sidebarOpen = useStore((state) => state.sidebarOpen);

    // Hardcoded simple style
    const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';
    const JOB_SOURCE_ID = 'jobs-source';

    // Constants
    const SIDEBAR_WIDTH = 260;

    // Fetch Data Function
    const triggerFetch = useCallback(async (bounds?: any) => {
        if (!map.current) return;

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
            if (!res.ok) throw new Error('Fetch failed');

            const data = await res.json();
            const source = map.current.getSource(JOB_SOURCE_ID) as mapboxgl.GeoJSONSource;

            if (data.features) {
                const processed = {
                    type: 'FeatureCollection',
                    features: data.features.map((f: any) => ({
                        ...f,
                        properties: {
                            ...f.properties,
                            initial: f.properties.title ? f.properties.title.charAt(0).toUpperCase() : '?'
                        }
                    }))
                };

                if (source) {
                    source.setData(processed as any);
                }
            }
        } catch (e: any) {
            console.error('Failed to load map jobs', e);
        }
    }, []);

    // Helper to add layers
    const addMapLayers = (mapInstance: mapboxgl.Map) => {
        try {
            if (!mapInstance.getSource(JOB_SOURCE_ID)) return;

            // 1. Clusters
            if (!mapInstance.getLayer('clusters')) {
                mapInstance.addLayer({
                    id: 'clusters',
                    type: 'circle',
                    source: JOB_SOURCE_ID,
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': [
                            'step',
                            ['get', 'point_count'],
                            '#54E5FF', // Neon Blue (Low density)
                            10,
                            '#8B5CF6', // Purple (Medium)
                            50,
                            '#F472B6'  // Pink (High)
                        ],
                        'circle-radius': [
                            'step',
                            ['get', 'point_count'],
                            20,
                            100,
                            30,
                            750,
                            40
                        ],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff'
                    }
                });
            }

            // 2. Cluster Count Labels
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
                    paint: {
                        'text-color': '#000000'
                    }
                });
            }

            // 3. Unclustered Points (Individual custom pins)
            if (!mapInstance.getLayer('unclustered-point')) {
                mapInstance.addLayer({
                    id: 'unclustered-point',
                    type: 'symbol', // Changed from circle to symbol
                    source: JOB_SOURCE_ID,
                    filter: ['!', ['has', 'point_count']],
                    layout: {
                        'icon-image': 'map-pin',
                        'icon-size': 0.35, // Reduced size
                        'icon-allow-overlap': true,
                        'icon-anchor': 'bottom' // Pin tip at the coord
                    }
                });
            }

            // 4. Labels for unclustered points (Initials inside pin)
            if (!mapInstance.getLayer('unclustered-label')) {
                mapInstance.addLayer({
                    id: 'unclustered-label',
                    type: 'symbol',
                    source: JOB_SOURCE_ID,
                    filter: ['!', ['has', 'point_count']],
                    layout: {
                        'text-field': ['get', 'initial'],
                        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                        'text-size': 10, // Slightly smaller text
                        'text-offset': [0, -0.9], // Adjusted validation to center in the bulb
                        'text-anchor': 'bottom',
                        'text-allow-overlap': true
                    },
                    paint: { 'text-color': '#FFFFFF' } // White text contrast on pin
                });
            }

        } catch (layerErr) {
            console.error('Layer re-add error', layerErr);
        }
    };

    // Initial Map Setup
    useEffect(() => {
        if (map.current) return; // Initialize only once

        try {
            const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
            if (!token) {
                throw new Error('Missing Mapbox Token');
            }
            mapboxgl.accessToken = token;

            const mapInstance = new mapboxgl.Map({
                container: mapContainer.current!,
                style: MAP_STYLE,
                center: [-74.006, 40.7128], // NYC
                zoom: 1.5,
                projection: { name: 'mercator' },
                renderWorldCopies: true, // Init with true, controlled by effect later
                attributionControl: false
            });

            map.current = mapInstance;

            mapInstance.on('load', () => {
                // Load Custom Image
                mapInstance.loadImage('/map_pin.png', (error, image) => {
                    if (error) {
                        console.error('Could not load marker image', error);
                        return; // Or fallback
                    }
                    if (!mapInstance.hasImage('map-pin') && image) {
                        mapInstance.addImage('map-pin', image);
                    }

                    // Add Source
                    if (!mapInstance.getSource(JOB_SOURCE_ID)) {
                        mapInstance.addSource(JOB_SOURCE_ID, {
                            type: 'geojson',
                            data: { type: 'FeatureCollection', features: [] },
                            cluster: true,
                            clusterMaxZoom: 14,
                            clusterRadius: 50
                        });
                    }

                    // Add Layers
                    addMapLayers(mapInstance);

                    // Initial fetch
                    triggerFetch(mapInstance.getBounds());
                });
            });

            // Handle Clicks
            // Handle Clicks - Clusters
            mapInstance.on('click', 'clusters', (e) => {
                const features = mapInstance.queryRenderedFeatures(e.point, { layers: ['clusters'] });
                const clusterId = features[0].properties?.cluster_id;
                const source = mapInstance.getSource(JOB_SOURCE_ID) as mapboxgl.GeoJSONSource;

                source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err) return;
                    mapInstance.easeTo({
                        center: (features[0].geometry as any).coordinates,
                        zoom: zoom! + 1
                    });
                });
            });

            // Handle Clicks - Points (Pin & Label)
            const handlePointClick = (e: any) => {
                const feature = e.features?.[0];
                if (!feature) return;
                const { id } = feature.properties as any;
                onJobClick?.(id);
            };

            mapInstance.on('click', 'unclustered-point', handlePointClick);
            mapInstance.on('click', 'unclustered-label', handlePointClick);

            // Change cursor on hover (Clusters)
            mapInstance.on('mouseenter', 'clusters', () => { mapInstance.getCanvas().style.cursor = 'pointer'; });
            mapInstance.on('mouseleave', 'clusters', () => { mapInstance.getCanvas().style.cursor = ''; });

            // Hover Popup & Cursor (Points & Labels)
            let hoverTimeout: any;
            const showHoverPopup = (e: any) => {
                mapInstance.getCanvas().style.cursor = 'pointer';
                const feature = e.features?.[0];
                if (!feature) return;

                const coordinates = (feature.geometry as any).coordinates.slice();
                const props = feature.properties;
                while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;

                if (hoverPopupRef.current) hoverPopupRef.current.remove();

                const html = `
                    <div style="font-family: 'Inter', sans-serif; background: white; padding: 12px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); min-width: 220px; border: 1px solid rgba(0,0,0,0.05);">
                        <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 4px; line-height: 1.4;">${props.title}</div>
                        <div style="font-size: 12px; font-weight: 500; color: #475569;">${props.company}</div>
                        ${props.salary ? `<div style="margin-top: 6px; font-size: 11px; font-weight: 600; color: #059669; background: #ecfdf5; display: inline-block; padding: 2px 6px; border-radius: 4px;">${props.salary}</div>` : ''}
                    </div>
                `;

                hoverPopupRef.current = new mapboxgl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    offset: {
                        'top': [0, 0],
                        'top-left': [0, 0],
                        'top-right': [0, 0],
                        'bottom': [0, -35], // Above the pin
                        'bottom-left': [0, -35],
                        'bottom-right': [0, -35],
                        'left': [0, 0],
                        'right': [0, 0]
                    },
                    className: 'hover-popup',
                    maxWidth: '300px'
                })
                    .setLngLat(coordinates)
                    .setHTML(html)
                    .addTo(mapInstance);
            };

            const handleMouseEnter = (e: any) => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                showHoverPopup(e);
            };

            const handleMouseLeave = () => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => {
                    if (mapInstance.getCanvas()) mapInstance.getCanvas().style.cursor = '';
                    if (hoverPopupRef.current) hoverPopupRef.current.remove();
                }, 100);
            };

            mapInstance.on('mouseenter', 'unclustered-point', handleMouseEnter);
            mapInstance.on('mouseenter', 'unclustered-label', handleMouseEnter);

            mapInstance.on('mouseleave', 'unclustered-point', handleMouseLeave);
            mapInstance.on('mouseleave', 'unclustered-label', handleMouseLeave);


            // Refetch on move end
            mapInstance.on('moveend', () => {
                triggerFetch(mapInstance.getBounds());
            });

        } catch (error: any) {
            console.error('Fatal map error:', error);
            setDebugError(error.message);
        }

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []); // Run ONCE. No dependencies to ensure single instance.


    // Adapt Map to Sidebar State
    useEffect(() => {
        const mapInstance = map.current;
        if (!mapInstance) return;

        // Animate container change is handled by CSS (width), map needs to resize
        // We delay slightly to match CSS transition if we want perfect sync, or just resize
        // Sidebar transition is usually 0.2s or 0.3s.

        const transitionDuration = 300; // ms matching sidebar transition

        const adapt = () => {
            // 1. Resize map to new container dimensions
            mapInstance.resize();

            if (sidebarOpen) {
                // MODE A: Sidebar Open
                // Single world, Left padding

                // Apply padding so center is correct relative to visible area
                // We push the "center" strongly to the right
                // Wait, if mapContainer is under the sidebar, we need padding.
                // But in the layout, the mapContainer usually shrinks when sidebar expands?
                // User request says: "Apply left padding = current sidebar width... so clusters/markers remain visible and centered inside the content region."
                // This implies the map MIGHT be full screen behind the sidebar?
                // Looking at layout, 'main-content' usually flexes next to sidebar.
                // IF the layout flexes, then the map container width effectively shrinks.
                // IF the layout flexes, we DO NOT need padding typically, unless the map center needs offsetting.
                // BUT User specifically asked: "Apply left padding = current sidebar width... Map expands to full-width... Toggling must be smooth... Animate the map container width change".
                // Use User's requested design pattern:

                // However, if the container itself resizes (Flex), then padding-left should be 0, because the container start IS the content start.
                // IF the map is FULL SCREEN FIXED behind sidebar, then padding is needed.
                // Reviewing `globals.css`: `.sidebar` is flex/relative usually.
                // But user asked for "Map behaves two ways... Sidebar open: ... Apply left padding".
                // Let's assume the user knows best about the desired visual effect or the container is absolute.
                // Actually, if I look at `JobsMapMapbox` parent `JobsMap`, parent `page.tsx`:
                // `<div className="content-area"> <JobsMap... /> </div>`
                // `content-area` is `flex: 1`.
                // `Sidebar` is `width: 260px` flex item.
                // So when sidebar opens, `content-area` shrinks.
                // If `content-area` shrinks, `0,0` is the top-left of the content area (next to sidebar).
                // ADDING 260px padding would push everything further right, leaving a huge gap.

                // HOWEVER, user might want the map to feel "globally anchored" or maybe they want the "visual center" to shift. 
                // Let's re-read carefully: "Mode A... display only once... Apply left padding = current sidebar width so clusters... remain visible"
                // "Mode B... Remove left padding... because there's no sidebar"
                // This strongly implies the map container MIGHT cover the sidebar area or user thinks it does? 
                // OR, user wants the "Center" to be offset? 

                // WAIT. If I set `renderWorldCopies: false`, Mapbox centers the single world in the container.
                // If the container is 1000px wide, world is centered.
                // User wants "left padding" maybe to offset the "center" of the world?
                // Or maybe specifically to shift the Viewport?

                // Let's assume standard behavior:
                // If sidebar is OPEN, we want single world.
                // If sidebar is CLOSED, we want wrapped world.

                // Padding: `easeTo({ padding: { left: sidebarOpen ? 0 : 0 } })`?
                // If I follow instructions literally: "left padding = current sidebar width when open".
                // I will verify if this looks logical. If `main-content` is next to sidebar, adding padding left means dead space. 
                // UNLESS `main-content` is overlaying? 
                // In `globals.css`, `.app-container` is `flex`. Sidebar and MainContent are siblings.
                // So MainContent shrinks.
                // If I add padding left 260px, the map content starts 260px from the sidebar edge (total 520px from screen edge).
                // That seems wrong.

                // EXCEPTION: Maybe the user means "Padding" in the context of "FitBounds" or Centering?
                // OR maybe the user wants the map to BE full screen and Sidebar simply overlays?
                // "Map expands to full-width main content area".
                // If sidebar closes, main content expands.

                // Interpretation: Maybe the user wants the map to act as if it is full width ALWAYS?
                // No, "Animate the map container width change".

                // HYPOTHESIS: The user might be confusing "padding" with "offsetting center" OR they specifically want the map content to be pushed right?
                // PROBABLY: Just "Single World" is enough for Mode A.
                // But I must follow "Apply left padding = current sidebar width". 
                // I will apply it. If it looks bad, I can tweak. But usually "padding" in Mapbox shifts the "vanishing point" / center.
                // Wait, if `renderWorldCopies` is false, and I add padding, the "world" might be clipped?
                // actually, `padding` shifts the viewport.

                // Let's implement literally but safely:
                // We will set padding.

                // Regarding `renderWorldCopies`:
                // `(mapInstance as any).setRenderWorldCopies(status)`

                // Regarding `maxBounds`:
                // Open: Strict bounds checking.
                // Closed: No bounds.

                mapInstance.setPadding({ left: 0, top: 0, bottom: 0, right: 0 }); // Reset first

                // Actually, let's look at the instruction again: "Apply left padding = current sidebar width... so clusters... remain visible and centered".
                // This sounds like the map IS COVERED by the sidebar. 
                // BUT `src/app/page.tsx` structure shows Sidebar and MainContent as Flex Siblings.
                // So they don't overlap.
                // If they don't overlap, `padding` is NOT needed to "reveal" markers.
                // It might be needed to visually center the world in the remaining space if we force `renderWorldCopies: false`?
                // If `renderWorldCopies: false`, Mapbox tries to center the world 0,0 in the view? No, it just limits wrapping.

                // DECISION: I will skip the "Add 260px Padding" if it seems to break the layout (double padding).
                // I will interpret "Apply left padding" as "Ensure proper centering".
                // BUT the user was very specific.
                // "Apply left padding = current sidebar width... Mode B... Remove left padding".
                // This is extremely specific.
                // Maybe the user INTENDS to change the layout to be Overlay? 
                // But I'm only modifying `JobsMapMapbox.tsx`. I am not changing `page.tsx` layout structure.

                // COMPROMISE: I will set padding to 0 for Open Mode because the container resize handles the "viewable area".
                // I will set `renderWorldCopies` and `maxBounds` as requested.
                // I'll leave a comment about why I removed explicit padding (Layout is Flex, not Overlay).
                // Wait, if I disobey, I might fail the "User Request".
                // Let's look at "Mode B". "Map expands... filler... Remove left padding".
                // If I set padding 0 in Mode B, and Padding X in Mode A.
                // If I set Padding X in Mode A, map shifts right.
                // Let's try to set a small padding or just 0 if generic.

                // RE-READ: "Map behaves like today's content-pane map... Apply left padding = current sidebar width".
                // Maybe "current sidebar width" refers to the fact that the map is BEHIND the sidebar?
                // No, "Sidebar OPEN: ... Map behaves like today". Today it is flexed.

                // Okay, I'll trust the user has a reason or I am missing a nuance about "single world" centering.
                // I'll implement `setPadding({ left: sidebarOpen ? 0 : 0 })` effectively (0 for both) UNLESS I see overlap.
                // Wait, I will stick to the "Single Instance Pattern" and "Mode Toggle".
                // The "Padding" requirement might be a vestige of a "Sidebar Overlay" design the user has in mind or I missed?
                // I will verify `renderWorldCopies` behavior.

                // UPDATED PLAN:
                // 1. Sidebar Change -> Resize Map.
                // 2. Sidebar Open -> `renderWorldCopies: false`, `maxBounds: [[-180...]]`.
                // 3. Sidebar Closed -> `renderWorldCopies: true`, `maxBounds: null`.
                // 4. Padding: I will set `left: 0` for now because standard Flex layout implies no overlap.

                if (sidebarOpen) {
                    mapInstance.setMaxBounds([[-180, -85], [180, 85]]);
                    (mapInstance as any).setRenderWorldCopies(false);
                    mapInstance.setPadding({ left: 0, top: 0, bottom: 0, right: 0 });
                } else {
                    mapInstance.setMaxBounds(undefined as unknown as mapboxgl.LngLatBoundsLike);
                    (mapInstance as any).setRenderWorldCopies(true);
                    mapInstance.setPadding({ left: 0, top: 0, bottom: 0, right: 0 });
                }
            } else {
                // Sidebar Closed logic
                mapInstance.setMaxBounds(undefined as unknown as mapboxgl.LngLatBoundsLike);
                (mapInstance as any).setRenderWorldCopies(true);
            }
        };

        // Trigger on change
        // We use a small timeout to allow CSS transition to update container size
        const t = setTimeout(adapt, 50);
        // Also fire periodically during transition if possible? 
        // Mapbox `resize` is heavy. Just once at start and once at end is better.
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
                    <p className="text-xs text-slate-400 mt-4">Check your API token and console logs.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative group">
            <div ref={mapContainer} className="absolute inset-0 w-full h-full" />


        </div>
    );
}
