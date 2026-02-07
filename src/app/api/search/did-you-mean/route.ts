import { NextRequest, NextResponse } from 'next/server';
import { suggestCorrection, generateAlternatives } from '@/lib/search';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search/did-you-mean?query={query}
 * 
 * Provides spelling corrections and alternative search suggestions
 * when a query returns no or few results
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    if (!query || query.length < 3) {
      return NextResponse.json({
        original: query || '',
        suggestion: null,
        alternatives: [],
        hasCorrection: false
      });
    }

    // Get spelling correction
    const suggestion = suggestCorrection(query);
    
    // Get alternative phrasings
    const alternatives = generateAlternatives(query);

    return NextResponse.json({
      original: query,
      suggestion,           // Corrected spelling (e.g., "sofware" -> "software")
      alternatives,         // Alternative searches (e.g., "software engineer" -> "software developer")
      hasCorrection: !!suggestion || alternatives.length > 0
    });

  } catch (error) {
    console.error('[DidYouMean API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate suggestions',
        message: error instanceof Error ? error.message : 'Unknown error',
        original: '',
        suggestion: null,
        alternatives: [],
        hasCorrection: false
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/search/did-you-mean
 * 
 * Same functionality as GET but accepts the query in the request body
 * Useful for longer queries that might exceed URL length limits
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.length < 3) {
      return NextResponse.json({
        original: query || '',
        suggestion: null,
        alternatives: [],
        hasCorrection: false
      });
    }

    const suggestion = suggestCorrection(query);
    const alternatives = generateAlternatives(query);

    return NextResponse.json({
      original: query,
      suggestion,
      alternatives,
      hasCorrection: !!suggestion || alternatives.length > 0
    });

  } catch (error) {
    console.error('[DidYouMean API] POST Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate suggestions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
