import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireProvider } from '@/lib/api-auth';

// Haversine formula to calculate distance in miles between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// POST /api/provider/optimize-route
// Sorts a list of job IDs sequentially based on driving distance using a greedy Nearest-Neighbor heuristic.
export async function POST(request: Request) {
  const { provider, error: authError } = await requireProvider();
  if (authError) return authError;

  try {
    const { jobIds, startLat, startLng } = await request.json();

    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ error: 'An array of jobIds is required' }, { status: 400 });
    }

    // Fetch the jobs
    const jobs = await db.job.findMany({
      where: {
        id: { in: jobIds },
      },
    });

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs found matching the provided IDs' }, { status: 404 });
    }

    // Find the starting coordinates
    let currentLat = startLat !== undefined ? parseFloat(startLat) : null;
    let currentLng = startLng !== undefined ? parseFloat(startLng) : null;

    if (currentLat === null || currentLng === null) {
      // Use provider home coordinates if available
      if (provider.latitude !== null && provider.longitude !== null) {
        currentLat = provider.latitude;
        currentLng = provider.longitude;
      } else {
        // Fallback to the first job's coordinates
        const firstJobWithCoords = jobs.find(j => j.latitude !== null && j.longitude !== null);
        if (firstJobWithCoords) {
          currentLat = firstJobWithCoords.latitude;
          currentLng = firstJobWithCoords.longitude;
        } else {
          // No coordinates anywhere, return sorted by creation date
          return NextResponse.json({
            jobs: jobs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
            totalDistanceMi: 0,
            hasCoordinates: false,
          });
        }
      }
    }

    // Nearest-Neighbor TSP implementation
    const unvisited = [...jobs];
    const route = [];
    let totalDistance = 0;

    let currentPoint = { lat: currentLat!, lng: currentLng! };

    while (unvisited.length > 0) {
      let nearestIndex = -1;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const job = unvisited[i];
        if (job.latitude !== null && job.longitude !== null) {
          const dist = calculateDistance(currentPoint.lat, currentPoint.lng, job.latitude, job.longitude);
          if (dist < minDistance) {
            minDistance = dist;
            nearestIndex = i;
          }
        }
      }

      // If we couldn't find any job with coordinates, just take the first remaining unvisited job
      if (nearestIndex === -1) {
        const nextJob = unvisited.shift()!;
        route.push({
          ...nextJob,
          distanceFromPreviousMi: 0,
        });
      } else {
        const nextJob = unvisited.splice(nearestIndex, 1)[0];
        totalDistance += minDistance;
        route.push({
          ...nextJob,
          distanceFromPreviousMi: Math.round(minDistance * 10) / 10,
        });
        currentPoint = { lat: nextJob.latitude!, lng: nextJob.longitude! };
      }
    }

    return NextResponse.json({
      jobs: route,
      totalDistanceMi: Math.round(totalDistance * 10) / 10,
      hasCoordinates: true,
    });
  } catch (error: any) {
    console.error('[Route Optimizer] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to optimize route' }, { status: 500 });
  }
}
